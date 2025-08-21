# file: fetch_api.py
import os
import re
import csv
import json
import time
import random
import argparse
from pathlib import Path
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo
import requests

# =========================
# CONFIG
# =========================
SEASON_WEEKS = 38
TZ_MADRID = ZoneInfo("Europe/Madrid")

SUBSCRIPTION_KEY = os.environ.get("SUBSCRIPTION_KEY", "")
BASE_WEEK_URL_1 = os.environ.get("BASE_WEEK_URL_1", "")
BASE_WEEK_URL_2 = os.environ.get("BASE_WEEK_URL_2", "")

OUT_DIR_JSON_1 = Path("football/data/laliga/json")
OUT_DIR_JSON_2 = Path("football/data/laliga2/json")
META_DIR_1     = Path("football/data/laliga/meta")
META_DIR_2     = Path("football/data/laliga2/meta")

WEEKDAY_ABBR_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]


# =========================
# MODELO DE LIGA
# =========================
@dataclass
class LeagueConfig:
    name: str                 # etiqueta para logs: "LaLiga", "LaLiga2", etc.
    base_week_url: str        # BASE_WEEK_URL_X
    out_dir_json: Path        # OUT_DIR_JSON_X
    meta_dir: Path            # META_DIR_X


# =========================
# UTILIDADES
# =========================
def clean_team_name(name: str) -> str:
    if not name:
        return ""
    name = re.sub(r"\s*SAD\s*", " ", name, flags=re.IGNORECASE)
    name = re.sub(r"Club de Fútbol", "CF", name, flags=re.IGNORECASE)
    name = re.sub(r"Fútbol Club", "FC", name, flags=re.IGNORECASE)
    name = re.sub(r"\s{2,}", " ", name).strip()
    return name

def parse_matches(obj):
    if isinstance(obj, dict) and isinstance(obj.get("matches"), list):
        return obj["matches"]
    if isinstance(obj, list):
        return obj
    return []

def format_fecha_y_hora(iso_str: str) -> tuple[str, str]:
    if not iso_str:
        return ("", "--:--")
    try:
        dt_utc = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        dt_local = dt_utc.astimezone(TZ_MADRID)
        weekday = WEEKDAY_ABBR_ES[dt_local.weekday()]
        fecha = f"{weekday} {dt_local.strftime('%d-%m-%Y')}"
        # Algunas APIs ponen 00:00 cuando aún no hay horario definitivo.
        if dt_utc.hour == 0 and dt_utc.minute == 0 and dt_utc.second == 0:
            hora = "--:--"
        else:
            hora = dt_local.strftime("%H:%M")
        return (fecha, hora)
    except Exception:
        fecha = iso_str.split("T", 1)[0] if "T" in iso_str else iso_str
        return (fecha, "--:--")

def resultado_partido(match) -> str:
    status = match.get("status") or match.get("matchStatus")
    if status != "FullTime":
        return "VS"
    hs = match.get("home_score", match.get("homeScore"))
    as_ = match.get("away_score", match.get("awayScore"))
    if isinstance(hs, int) and isinstance(as_, int):
        return f"{hs} - {as_}"
    return "VS"

def extract_row(match, week_label: str) -> list[str]:
    iso = match.get("date") or match.get("time") or ""
    fecha, hora = format_fecha_y_hora(iso)
    home = match.get("home_team") or match.get("homeTeam") or {}
    away = match.get("away_team") or match.get("awayTeam") or {}
    local = clean_team_name(home.get("nickname") or home.get("name") or "")
    visitante = clean_team_name(away.get("nickname") or away.get("name") or "")
    resultado = resultado_partido(match)
    return [str(week_label), fecha, hora, local, resultado, visitante]


# =========================
# META (Last-Modified) por liga
# =========================
def _meta_path(cfg: LeagueConfig, week: int) -> Path:
    cfg.meta_dir.mkdir(parents=True, exist_ok=True)
    return cfg.meta_dir / f"week_{week}.lastmod"

def _load_lastmod(cfg: LeagueConfig, week: int) -> str | None:
    p = _meta_path(cfg, week)
    return p.read_text().strip() if p.exists() else None

def _save_lastmod(cfg: LeagueConfig, week: int, lastmod: str):
    _meta_path(cfg, week).write_text(lastmod.strip(), encoding="utf-8")


# =========================
# SALIDAS LOCALES
# =========================
def _outputs_exist(cfg: LeagueConfig, week: int) -> bool:
    j = cfg.out_dir_json / f"matches_week_{week}.json"
    # c = cfg.out_dir_csv  / f"matches_week_{week}.csv"
    return j.exists()


# =========================
# FETCH SEMANA por liga (con flags de caché/meta)
# =========================
def fetch_week_json(cfg: LeagueConfig, week: int, use_cache: bool = True, write_meta: bool = True):
    if not SUBSCRIPTION_KEY:
        raise RuntimeError("Falta SUBSCRIPTION_KEY.")
    if not cfg.base_week_url:
        raise RuntimeError(f"[{cfg.name}] Falta BASE_WEEK_URL.")

    url = f"{cfg.base_week_url}/week/{week}/matches"
    params = {
        "contentLanguage": "es",
        "countryCode": "ES",
        "subscription-key": SUBSCRIPTION_KEY,
    }
    headers = {}

    if use_cache:
        prev_lm = _load_lastmod(cfg, week)
        if prev_lm:
            headers["If-Modified-Since"] = prev_lm

    resp = requests.get(url, params=params, headers=headers, timeout=30)

    if use_cache and resp.status_code == 304:
        print(f"🔄 [{cfg.name}] Semana {week}: sin cambios (If-Modified-Since).")
        return None

    resp.raise_for_status()
    data = resp.json()

    if write_meta:
        new_lm = resp.headers.get("Last-Modified")
        if new_lm:
            _save_lastmod(cfg, week, new_lm)

    return data


# =========================
# DETECCIÓN DE JORNADA por liga
# =========================
def detect_current_week(cfg: LeagueConfig, now_madrid: datetime, window_days: int = 4) -> int:
    """
    Heurística: buscamos una jornada con algún partido cuya fecha esté a ±window_days días.
    Durante la detección NO usamos caché (para no filtrar por 304), pero SÍ guardamos meta
    para “calentar” Last-Modified y ser eficientes en la fase real.
    """
    for w in range(1, SEASON_WEEKS + 1):
        try:
            data = fetch_week_json(cfg, w, use_cache=False, write_meta=True)
        except Exception:
            continue
        if not data:
            continue
        matches = parse_matches(data)
        for m in matches:
            iso = m.get("date") or m.get("time")
            if not iso:
                continue
            try:
                dt = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(TZ_MADRID)
            except Exception:
                continue
            if abs((dt - now_madrid).total_seconds()) <= window_days * 86400:
                return w
    return 1


# =========================
# I/O por liga
# =========================
def save_json(cfg: LeagueConfig, data: dict, week: int):
    cfg.out_dir_json.mkdir(parents=True, exist_ok=True)
    path = cfg.out_dir_json / f"matches_week_{week}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return path

def update_main_json(cfg: LeagueConfig, main_json_path: Path):
    """
    Combina todos los archivos matches_week_{n}.json en un único archivo main_json_path.
    Conserva las jornadas existentes si no hay datos nuevos.
    Solo sobrescribe si hay cambios.
    """
    # Cargar el contenido actual si existe
    if main_json_path.exists():
        with open(main_json_path, "r", encoding="utf-8") as f:
            current = json.load(f)
    else:
        current = {}

    all_weeks = dict(current)  # Copia actual

    for week in range(1, SEASON_WEEKS + 1):
        week_path = cfg.out_dir_json / f"matches_week_{week}.json"
        if week_path.exists():
            with open(week_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                matches = parse_matches(data)
                all_weeks[str(week)] = []
                for m in matches:
                    row = extract_row(m, str(week))
                    all_weeks[str(week)].append({
                        "Jornada": int(row[0]),
                        "Fecha": row[1],
                        "Horario": row[2],
                        "Local": row[3],
                        "Resultado": row[4],
                        "Visitante": row[5]
                    })
        # Si no existe el archivo, conserva lo que ya había en current

    # Solo sobrescribe si hay cambios
    if current == all_weeks:
        print(f"🟢 Sin cambios en {main_json_path.name}, no se sobrescribe.")
        return
    with open(main_json_path, "w", encoding="utf-8") as f:
        json.dump(all_weeks, f, ensure_ascii=False, indent=2)
    print(f"🟡 {main_json_path.name} actualizado.")
def process_week(cfg: LeagueConfig, week: int, main_json_path: Path = None):
    try:
        data = fetch_week_json(cfg, week, use_cache=True, write_meta=True)
    except Exception as e:
        print(f"❌ [{cfg.name}] Semana {week}: error al descargar: {e}")
        return

    if data is None:
        if not _outputs_exist(cfg, week):
            print(f"⚠️  [{cfg.name}] Semana {week}: 304 pero faltan archivos locales; forzando descarga completa...")
            try:
                data = fetch_week_json(cfg, week, use_cache=False, write_meta=False)
            except Exception as e:
                print(f"❌ [{cfg.name}] Semana {week}: error al forzar descarga: {e}")
                return
        else:
            return

    p_json = save_json(cfg, data, week)
    print(f"✅ [{cfg.name}] Semana {week} guardada/actualizada: {p_json}")

    # Actualiza el archivo principal si se indica la ruta
    if main_json_path:
        update_main_json(cfg, main_json_path)

# =========================
# SECUENCIA COMPLETA POR LIGA
# =========================
def process_league(cfg: LeagueConfig, forced_week: int | None, sleep_between_weeks: tuple[int, int] = (35, 50)):
    """
    Descarga prev, actual y 3 siguientes para una liga.
    Respeta If-Modified-Since y guarda JSON+CSV.
    """
    now_madrid = datetime.now(TZ_MADRID)
    current = forced_week if forced_week else detect_current_week(cfg, now_madrid)

    weeks = []
    if current > 1:
        weeks.append(current - 1)
    weeks.append(current)
    for i in range(1, 4):  # 3 siguientes
        if current + i <= SEASON_WEEKS:
            weeks.append(current + i)

    print(f"🗓️ [{cfg.name}] Descargando semanas: {weeks}")

    # Definir ruta del archivo principal en el directorio correcto
    if cfg.name == "LaLiga":
        main_json_path = Path("football/data/laliga/matches_laliga.json")
    elif cfg.name == "LaLiga2":
        main_json_path = Path("football/data/laliga2/matches_laliga2.json")
    else:
        main_json_path = None

    for idx, w in enumerate(weeks):
        process_week(cfg, w, main_json_path=main_json_path)
        if idx < len(weeks) - 1:
            delay = random.randint(*sleep_between_weeks)
            print(f"⏳ [{cfg.name}] Esperando {delay}s antes de la siguiente semana...")
            time.sleep(delay)

# =========================
# MAIN
# =========================
def main():
    parser = argparse.ArgumentParser(
        description="Descarga jornadas (prev, actual, +3) para dos ligas con Last-Modified y genera JSON+CSV (primero liga1, luego liga2)."
    )
    parser.add_argument("--week1", type=int, help="Forzar semana actual para la LIGA 1 (1..38).")
    parser.add_argument("--week2", type=int, help="Forzar semana actual para la LIGA 2 (1..38).")
    parser.add_argument("--no-sleep", action="store_true", help="No esperar entre semanas (útil para pruebas locales).")
    args = parser.parse_args()

    # Construimos configs de liga a partir de las variables de entorno / rutas dadas.
    league1 = LeagueConfig(
        name="LaLiga",
        base_week_url=BASE_WEEK_URL_1,
        out_dir_json=OUT_DIR_JSON_1,
       #  out_dir_csv=OUT_DIR_CSV_1,
        meta_dir=META_DIR_1,
    )
    league2 = LeagueConfig(
        name="LaLiga2",
        base_week_url=BASE_WEEK_URL_2,
        out_dir_json=OUT_DIR_JSON_2,
        # out_dir_csv=OUT_DIR_CSV_2,
        meta_dir=META_DIR_2,
    )

    # Control de espera entre semanas
    sleep_range = (0, 0) if args.no_sleep else (35, 50)

    # Procesar primero liga 1
    if league1.base_week_url:
        print("🏁 Iniciando procesamiento de LIGA 1 (primero).")
        process_league(league1, forced_week=args.week1, sleep_between_weeks=sleep_range)
    else:
        print("⚠️ LIGA 1 omitida: falta BASE_WEEK_URL_1.")

    # Después liga 2
    if league2.base_week_url:
        print("➡️ Pasando a LIGA 2.")
        process_league(league2, forced_week=args.week2, sleep_between_weeks=sleep_range)
    else:
        print("⚠️ LIGA 2 omitida: falta BASE_WEEK_URL_2.")


if __name__ == "__main__":
    main()
