import os
import re
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

BASE_WEEK_URL = os.environ.get("BASE_WEEK_URL_PREM", "")
OUT_DIR_JSON = Path("football/data/premier_league/json")

WEEKDAY_ABBR_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

# =========================
# MODELO DE LIGA
# =========================
@dataclass
class LeagueConfig:
    name: str
    base_week_url: str
    out_dir_json: Path

# =========================
# UTILIDADES
# =========================
def clean_team_name(name: str) -> str:
    if not name:
        return ""
    name = re.sub(r"\s{2,}", " ", name).strip()
    return name

def parse_matches(obj):
    if isinstance(obj, dict) and isinstance(obj.get("data"), list):
        return obj["data"]
    if isinstance(obj, list):
        return obj
    return []

def format_fecha_y_hora(iso_str: str) -> tuple[str, str]:
    if not iso_str:
        return ("", "--:--")
    try:
        dt_naive = datetime.strptime(iso_str, "%Y-%m-%d %H:%M:%S")
        dt_london = dt_naive.replace(tzinfo=ZoneInfo("Europe/London"))
        dt_local = dt_london.astimezone(TZ_MADRID)
        weekday = WEEKDAY_ABBR_ES[dt_local.weekday()]
        fecha = f"{weekday} {dt_local.strftime('%d-%m-%Y')}"
        hora = dt_local.strftime("%H:%M")
        return (fecha, hora)
    except Exception:
        fecha = iso_str.split("T", 1)[0] if "T" in iso_str else iso_str
        return (fecha, "--:--")

def resultado_partido(match) -> str:
    if match.get("period") != "FullTime":
        return "VS"
    hs = match.get("homeTeam", {}).get("score")
    as_ = match.get("awayTeam", {}).get("score")
    if isinstance(hs, int) and isinstance(as_, int):
        return f"{hs} - {as_}"
    return "VS"

def extract_row(match, week_label: str) -> list[str]:
    dt_str = match.get("kickoff", "")
    fecha, hora = format_fecha_y_hora(dt_str)
    home = match.get("homeTeam", {})
    away = match.get("awayTeam", {})
    local = clean_team_name(home.get("name", ""))
    visitante = clean_team_name(away.get("name", ""))
    resultado = resultado_partido(match)
    return [str(week_label), fecha, hora, local, resultado, visitante]

# =========================
# SALIDAS LOCALES
# =========================
def _outputs_exist(cfg: LeagueConfig, week: int) -> bool:
    j = cfg.out_dir_json / f"matches_week_{week}.json"
    return j.exists()

# =========================
# FETCH SEMANA por liga (sin meta/lastmod)
# =========================
def fetch_week_json(cfg: LeagueConfig, week: int):
    if not cfg.base_week_url:
        raise RuntimeError(f"[{cfg.name}] Falta BASE_WEEK_URL.")

    url = cfg.base_week_url.replace("{week}", str(week))
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        # No mostrar el enlace en el error
        raise RuntimeError(f"[{cfg.name}] Error al descargar datos de la API para la semana {week}: {type(e).__name__}") from None

# =========================
# DETECCIÓN DE JORNADA por liga
# =========================
def detect_current_week(cfg: LeagueConfig, now_london: datetime, window_days: int = 5) -> int:
    closest_week = None
    closest_delta = None
    for w in range(1, SEASON_WEEKS + 1):
        try:
            data = fetch_week_json(cfg, w)
        except Exception:
            continue
        if not data:
            continue
        matches = parse_matches(data)
        for m in matches:
            dt_str = m.get("kickoff")
            if not dt_str:
                continue
            try:
                dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=TZ_MADRID)
            except Exception:
                continue
            delta = abs((dt - now_london).total_seconds())
            if delta <= window_days * 86400:
                return w
            if closest_delta is None or delta < closest_delta:
                closest_delta = delta
                closest_week = w
    return closest_week if closest_week else 1

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
    if main_json_path.exists():
        with open(main_json_path, "r", encoding="utf-8") as f:
            current = json.load(f)
    else:
        current = {}

    all_weeks = dict(current)

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
    if current == all_weeks:
        print(f"🟢 Sin cambios en {main_json_path.name}, no se sobrescribe.")
        return
    with open(main_json_path, "w", encoding="utf-8") as f:
        json.dump(all_weeks, f, ensure_ascii=False, indent=2)
    print(f"🟡 {main_json_path.name} actualizado.")

def process_week(cfg: LeagueConfig, week: int, main_json_path: Path = None):
    try:
        data = fetch_week_json(cfg, week)
    except Exception as e:
        print(f"❌ [{cfg.name}] Semana {week}: error al descargar: {e}")
        return

    if data is None:
        if not _outputs_exist(cfg, week):
            print(f"⚠️  [{cfg.name}] Semana {week}: sin datos y faltan archivos locales.")
        return

    p_json = save_json(cfg, data, week)
    print(f"✅ [{cfg.name}] Semana {week} guardada/actualizada: {p_json}")

    if main_json_path:
        update_main_json(cfg, main_json_path)

# =========================
# SECUENCIA COMPLETA POR LIGA
# =========================
def process_league(cfg: LeagueConfig, forced_week: int | None, sleep_between_weeks: tuple[int, int] = (35, 50)):
    now_madrid = datetime.now(TZ_MADRID)
    current = forced_week if forced_week else detect_current_week(cfg, now_madrid)

    weeks = []
    if current > 1:
        weeks.append(current - 1)
    weeks.append(current)
    for i in range(1, 5):
        if current + i <= SEASON_WEEKS:
            weeks.append(current + i)

    print(f"🗓️ [{cfg.name}] Descargando semanas: {weeks}")

    main_json_path = Path("football/data/premier_league/matches_premier_league.json")

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
        description="Descarga jornadas (prev, actual, +3) para Premier League y genera JSON."
    )
    parser.add_argument("--week", type=int, help="Forzar semana actual (1..38).")
    parser.add_argument("--no-sleep", action="store_true", help="No esperar entre semanas (útil para pruebas locales).")
    args = parser.parse_args()

    league = LeagueConfig(
        name="Premier League",
        base_week_url=BASE_WEEK_URL,
        out_dir_json=OUT_DIR_JSON,
    )

    sleep_range = (0, 0) if args.no_sleep else (35, 50)

    if league.base_week_url:
        print("🏁 Iniciando procesamiento de Premier League.")
        process_league(league, forced_week=args.week, sleep_between_weeks=sleep_range)
    else:
        print("⚠️ Premier League omitida: falta BASE_WEEK_URL_PREM.")

if __name__ == "__main__":
    main()