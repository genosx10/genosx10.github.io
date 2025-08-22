/* =========================
   Exportar a Google Calendar (.ics)
========================= */

function generateICS(rows) {
  function p2(n) {
    return (n < 10 ? "0" : "") + n;
  }
  function fmtLocal(y, m, d, hh, mm, ss) {
    return "" + y + p2(m) + p2(d) + "T" + p2(hh) + p2(mm) + p2(ss);
  }
  function parseYMD(ymd) {
    var p = (ymd || "").split("-");
    return { y: +p[0], m: +p[1], d: +p[2] };
  }
  function addHours(y, m, d, hh, mm, add) {
    var dt = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
    dt.setUTCHours(dt.getUTCHours() + add);
    return {
      y: dt.getUTCFullYear(),
      m: dt.getUTCMonth() + 1,
      d: dt.getUTCDate(),
      hh: dt.getUTCHours(),
      mm: dt.getUTCMinutes(),
      ss: dt.getUTCSeconds(),
    };
  }
  function fmtUTC(dt) {
    function p2(n) {
      return (n < 10 ? "0" : "") + n;
    }
    return (
      dt.getUTCFullYear() +
      p2(dt.getUTCMonth() + 1) +
      p2(dt.getUTCDate()) +
      "T" +
      p2(dt.getUTCHours()) +
      p2(dt.getUTCMinutes()) +
      p2(dt.getUTCSeconds()) +
      "Z"
    );
  }

  var now = new Date();
  var dtstamp = fmtUTC(now);

  var ics =
    "BEGIN:VCALENDAR\n" +
    "VERSION:2.0\n" +
    "PRODID:-\\-Calendario_Futbol//ES\n" +
    "CALSCALE:GREGORIAN\n" +
    "METHOD:PUBLISH\n" +
    "BEGIN:VTIMEZONE\n" +
    "TZID:Europe/Madrid\n" +
    "X-LIC-LOCATION:Europe/Madrid\n" +
    "BEGIN:DAYLIGHT\n" +
    "TZOFFSETFROM:+0100\n" +
    "TZOFFSETTO:+0200\n" +
    "TZNAME:CEST\n" +
    "DTSTART:19700329T020000\n" +
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\n" +
    "END:DAYLIGHT\n" +
    "BEGIN:STANDARD\n" +
    "TZOFFSETFROM:+0200\n" +
    "TZOFFSETTO:+0100\n" +
    "TZNAME:CET\n" +
    "DTSTART:19701025T030000\n" +
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\n" +
    "END:STANDARD\n" +
    "END:VTIMEZONE\n";

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var uid = Date.now() + "-" + i + "@laliga-cal";
    var ymdParts = parseYMD(r.FechaISO);
    var hm = parseHHMM(r.Horario);

    ics += "BEGIN:VEVENT\n";
    ics += "UID:" + uid + "\n";
    ics += "DTSTAMP:" + dtstamp + "\n";

    if (hm) {
      var startLocal = fmtLocal(
        ymdParts.y,
        ymdParts.m,
        ymdParts.d,
        hm.hh,
        hm.mm,
        0
      );
      var endParts = addHours(
        ymdParts.y,
        ymdParts.m,
        ymdParts.d,
        hm.hh,
        hm.mm,
        2
      );
      var endLocal = fmtLocal(
        endParts.y,
        endParts.m,
        endParts.d,
        endParts.hh,
        endParts.mm,
        endParts.ss
      );
      ics += "DTSTART;TZID=Europe/Madrid:" + startLocal + "\n";
      ics += "DTEND;TZID=Europe/Madrid:" + endLocal + "\n";
    } else {
      var d0 =
        "" +
        ymdParts.y +
        (ymdParts.m < 10 ? "0" : "") +
        ymdParts.m +
        (ymdParts.d < 10 ? "0" : "") +
        ymdParts.d;
      var endDay = addHours(ymdParts.y, ymdParts.m, ymdParts.d, 0, 0, 24);
      var d1 =
        "" +
        endDay.y +
        (endDay.m < 10 ? "0" : "") +
        endDay.m +
        (endDay.d < 10 ? "0" : "") +
        endDay.d;
      ics += "DTSTART;VALUE=DATE:" + d0 + "\n";
      ics += "DTEND;VALUE=DATE:" + d1 + "\n";
    }

    ics += "SUMMARY:" + (r.Local || "") + " vs " + (r.Visitante || "") + "\n";
    ics += "DESCRIPTION:Jornada " + (r.Jornada || "") + "\n";
    ics += "END:VEVENT\n";
  }

  ics += "END:VCALENDAR";
  return ics;
}

function exportToCalendar(rows) {
  var ics = generateICS(rows);
  var blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "laliga_calendario.ics";
  a.click();
  URL.revokeObjectURL(url);
}