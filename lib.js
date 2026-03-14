export function formatTime(timeStr) {
  const [h, m] = timeStr.split(':');
  let hour = parseInt(h, 10) % 24;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  if (hour > 12) hour -= 12;
  if (hour === 0) hour = 12;
  return `${hour}:${m} ${suffix}`;
}

export function buildTimetableHtml(stops, currentStopSeq, currentStatus, label) {
  let rows = '';
  stops.forEach(stop => {
    const seq = stop.stop_sequence;
    let cls = '';
    if (currentStatus === 'STOPPED_AT' && seq === currentStopSeq) {
      cls = 'stop-current';
    } else if (currentStatus === 'IN_TRANSIT_TO') {
      if (seq === currentStopSeq - 1) cls = 'stop-previous';
      else if (seq === currentStopSeq) cls = 'stop-next';
    }
    rows += `<tr class="${cls}"><td class="tt-time">${formatTime(stop.arrival_time)}</td><td>${stop.stop_name}</td></tr>`;
  });
  return `<div class="timetable-popup"><div class="tt-header">${label.replace('\n', '<br>')}</div><div class="tt-scroll"><table>${rows}</table></div></div>`;
}

export function indexStopsById(stopsRaw) {
  const stopsById = {};
  stopsRaw.forEach(s => { stopsById[s.stop_id] = s.stop_name; });
  return stopsById;
}

export function indexStopTimesByTrip(stopTimesRaw, stopsById) {
  const stopTimesByTrip = {};
  stopTimesRaw.forEach(st => {
    if (!stopTimesByTrip[st.trip_id]) stopTimesByTrip[st.trip_id] = [];
    stopTimesByTrip[st.trip_id].push({
      arrival_time: st.arrival_time,
      departure_time: st.departure_time,
      stop_id: st.stop_id,
      stop_sequence: Number(st.stop_sequence),
      stop_name: stopsById[st.stop_id] || st.stop_id,
    });
  });
  for (const tid in stopTimesByTrip) {
    stopTimesByTrip[tid].sort((a, b) => a.stop_sequence - b.stop_sequence);
  }
  return stopTimesByTrip;
}
