import requests
import time
import csv
import re
import random
import os
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo

# =========================
# CONFIGURACIÓN
# =========================
SEASON_YEAR = 2025
SUBSCRIPTION_KEY = os.environ["SUBSCRIPTION_KEY"]
BASE_URL = os.environ["BASE_URL"]

# Directorio de salida (relativo al repo)
CSV_DIR = Path("./football/data")

# Zona horaria para formatear horarios
TZ = ZoneInfo("Europe/Madrid")

# Abreviaturas de día (independientes del locale del SO)
WEEKDAY_ABBR_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

# Lista de equipos (slugs) a descargar
TEAM_SLUGS = [
    "athletic-club",
    "atletico-de-madrid",
    "c-a-osasuna",
    "d-alaves",
    "elche-c-f",
    "fc-barcelona",
    "getafe-cf",
    "girona-fc",
    "levante-ud",
    "rayo-vallecano",
    "rc-celta",
    "rcd-espanyol",
    "rcd-mallorca",
    "real-betis",
    "real-madrid",
    "real-oviedo",
    "real-sociedad",
    "sevilla-fc",
    "valencia-cf",
    "villarreal-cf",
]

# =========================
# UTILIDADES DE LIMPIEZA Y PARSEO
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
    if isinstance(obj, dict):
        if isinstance(obj.get("matches"), list):
            return obj["matches"]
        if isinstance(obj.get("content"), list):
            return obj["content"]
    if isinstance(obj, list):
        return obj
    return []

def get_competition_id(match) -> int | None:
    comp = match.get("competition")
    if isinstance(comp, dict) and "id" in comp:
        return comp["id"]
    tourn = match.get("tournament") or match.get("season") or {}
    if isinstance(tourn, dict):
        comp2 = tourn.get("competition") or {}
        if isinstance(comp2, dict) and "id" in comp2:
            return comp2["id"]
    return None

def jornada_number(gw: dict) -> str:
    if not isinstance(gw, dict):
        return ""
    if gw.get("week") is not None:
        return str(gw["week"])
    name = gw.get("name") or gw.get("shortname") or ""
    m = re.search(r"\d+", name)
    return m.group(0) if m else ""

def format_fecha_y_hora(iso_str: str) -> tuple[str, str]:
    if not iso_str:
        return ("", "--:--")
    try:
        dt_utc = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        dt_local = dt_utc.astimezone(TZ)
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
    """Devuelve 'X - Y' si el partido terminó (FullTime); si no, 'VS'."""
    status = match.get("status") or match.get("matchStatus")
    if status != "FullTime":
        return "VS"

    hs = match.get("home_score", match.get("homeScore"))
    as_ = match.get("away_score", match.get("awayScore"))

    if isinstance(hs, int) and isinstance(as_, int):
        return f"{hs} - {as_}"
    return "VS"

def extract_row(match):
    # Solo Primera División
    comp_id = get_competition_id(match)
    if comp_id != 1:
        return None

    jornada = jornada_number(match.get("gameweek") or {})

    iso = match.get("date") or match.get("time") or ""
    fecha, hora = format_fecha_y_hora(iso)

    home = match.get("home_team") or match.get("homeTeam") or {}
    away = match.get("away_team") or match.get("awayTeam") or {}
    local = clean_team_name(home.get("nickname") or home.get("name") or "")
    visitante = clean_team_name(away.get("nickname") or away.get("name") or "")

    resultado = resultado_partido(match)

    # Nueva estructura: Jornada, Fecha, Horario, Local, Resultado, Visitante
    return [jornada, fecha, hora, local, resultado, visitante]

# =========================
# DESCARGA + CONVERSIÓN
# =========================
def fetch_team_matches(team_slug: str) -> dict:
    params = {
        "seasonYear": SEASON_YEAR,
        "teamSlug": team_slug,
        "limit": 100,
        "orderField": "date",
        "orderType": "asc",
        "contentLanguage": "es",
        "countryCode": "ES",
        "subscription-key": SUBSCRIPTION_KEY,
    }
    resp = requests.get(BASE_URL, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()

def write_matches_csv(data: dict, out_csv: Path):
    matches = parse_matches(data)
    with open(out_csv, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(["Jornada", "Fecha", "Horario", "Local", "Resultado", "Visitante"])
        for m in matches:
            row = extract_row(m)
            if row is not None:  # solo comp.id == 1
                writer.writerow(row)

# =========================
# MAIN
# =========================
def main():
    CSV_DIR.mkdir(parents=True, exist_ok=True)

    order = TEAM_SLUGS[:]
    random.shuffle(order)

    total = len(order)

    for i, slug in enumerate(order, start=1):
        print(f"[{i}/{total}] Descargando: {slug}")
        try:
            data = fetch_team_matches(slug)
        except requests.HTTPError as e:
            status = e.response.status_code if e.response is not None else "?"
            print(f"  ❌ Error HTTP {status} para {slug}: {e}")
        except requests.RequestException as e:
            print(f"  ❌ Error de red para {slug}: {e}")
        else:
            csv_path = CSV_DIR / f"matches_{slug}.csv"
            try:
                write_matches_csv(data, csv_path)
                print(f"  ✅ CSV generado en: {csv_path}")
            except Exception as e:
                print(f"  ❌ Error al convertir a CSV para {slug}: {e}")

        if i < total:
            delay = random.randint(31, 50)
            print(f"  ⏳ Esperando {delay}s antes de la próxima solicitud...")
            time.sleep(delay)

    print("✅ Proceso completado.")

if __name__ == "__main__":
    main()
