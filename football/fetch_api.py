# file: fetch_api.py
import os
import re
import csv
import json
import time
import random
import argparse
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import requests

# =========================
# CONFIG
# =========================
SEASON_WEEKS = 38
TZ_MADRID = ZoneInfo("Europe/Madrid")

SUBSCRIPTION_KEY = os.environ.get("SUBSCRIPTION_KEY", "")
BASE_WEEK_URL = os.environ.get("BASE_WEEK_URL","")

OUT_DIR_JSON = Path("football/data/json")
OUT_DIR_CSV  = Path("football/data/csv")
META_DIR     = Path("football/data/meta")

WEEKDAY_ABBR_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]


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
# META (Last-Modified)
# =========================
def _meta_path(week: int) -> Path:
    META_DIR.mkdir(parents=True, exist_ok=True)
    return META_DIR / f"week_{week}.lastmod"

def _load_lastmod(week: int) -> str | None:
    p = _meta_path(week)
    return p.read_text().strip() if p.exists() else None

def _save_lastmod(week: int, lastmod: str):
    _meta_path(week).write_text(lastmod.strip(), encoding="utf-8")


# =========================
# FETCH SEMANA
# =========================
def fetch_week_json(week: int):
    if not SUBSCRIPTION_KEY:
        raise RuntimeError("Falta SUBSCRIPTION_KEY.")

    url = f"{BASE_WEEK_URL}/week/{week}/matches"
    params = {"contentLanguage": "es", "countryCode": "ES", "subscription-key": SUBSCRIPTION_KEY}
    headers = {}

    prev_lm = _load_lastmod(week)
    if prev_lm:
        headers["If-Modified-Since"] = prev_lm

    resp = requests.get(url, params=params, headers=headers, timeout=30)

    if resp.status_code == 304:
        print(f"🔄 Semana {week}: sin cambios (If-Modified-Since).")
        return None

    resp.raise_for_status()
    data = resp.json()

    new_lm = resp.headers.get("Last-Modified")
    if new_lm:
        _save_lastmod(week, new_lm)

    return data


# =========================
# DETECCIÓN DE JORNADA
# =========================
def detect_current_week(now_madrid: datetime, window_days: int = 4) -> int:
    for w in range(1, SEASON_WEEKS + 1):
        try:
            data = fetch_week_json(w)
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
# I/O
# =========================
def save_json(data: dict, week: int):
    OUT_DIR_JSON.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR_JSON / f"matches_week_{week}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return path

def save_csv(data: dict, week: int):
    OUT_DIR_CSV.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR_CSV / f"matches_week_{week}.csv"
    matches = parse_matches(data)
    with open(path, "w", newline="", encoding="utf-8") as csvfile:
        w = csv.writer(csvfile)
        w.writerow(["Jornada", "Fecha", "Horario", "Local", "Resultado", "Visitante"])
        for m in matches:
            w.writerow(extract_row(m, str(week)))
    return path


# =========================
# PROCESO POR SEMANA
# =========================
def process_week(week: int):
    try:
        data = fetch_week_json(week)
    except Exception as e:
        print(f"❌ Semana {week}: error al descargar: {e}")
        return
    if data is None:
        return
    p_json = save_json(data, week)
    p_csv  = save_csv(data, week)
    print(f"✅ Semana {week} guardada/actualizada: {p_json} | {p_csv}")


# =========================
# MAIN
# =========================
def main():
    parser = argparse.ArgumentParser(description="Descarga jornadas (prev, actual, +3) con Last-Modified y genera JSON+CSV.")
    parser.add_argument("--week", type=int, help="Forzar semana actual (1..38).")
    args = parser.parse_args()

    now_madrid = datetime.now(TZ_MADRID)
    current = args.week if args.week else detect_current_week(now_madrid)

    weeks = []
    if current > 1:
        weeks.append(current - 1)
    weeks.append(current)
    for i in range(1, 4):  # 3 siguientes
        if current + i <= SEASON_WEEKS:
            weeks.append(current + i)

    print(f"🗓️ Descargando semanas: {weeks}")

    for idx, w in enumerate(weeks):
        process_week(w)
        if idx < len(weeks) - 1:
            delay = random.randint(35, 50)
            print(f"⏳ Esperando {delay}s antes de la siguiente semana...")
            time.sleep(delay)


if __name__ == "__main__":
    main()
