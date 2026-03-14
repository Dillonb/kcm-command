import { describe, it, expect } from 'vitest';
import {
  formatTime,
  buildTimetableHtml,
  indexStopsById,
  indexStopTimesByTrip,
} from './lib.js';

describe('formatTime', () => {
  it('formats morning time', () => {
    expect(formatTime('07:30:00')).toBe('7:30 AM');
  });

  it('formats afternoon time', () => {
    expect(formatTime('14:05:00')).toBe('2:05 PM');
  });

  it('formats noon as 12 PM', () => {
    expect(formatTime('12:00:00')).toBe('12:00 PM');
  });

  it('formats midnight as 12 AM', () => {
    expect(formatTime('00:15:00')).toBe('12:15 AM');
  });

  it('handles GTFS times past midnight (e.g. 25:00)', () => {
    expect(formatTime('25:30:00')).toBe('1:30 AM');
  });
});

describe('buildTimetableHtml', () => {
  const stops = [
    { stop_sequence: 1, arrival_time: '08:00:00', stop_name: 'First Stop' },
    { stop_sequence: 2, arrival_time: '08:05:00', stop_name: 'Second Stop' },
    { stop_sequence: 3, arrival_time: '08:10:00', stop_name: 'Third Stop' },
  ];

  it('renders all stops in a table', () => {
    const html = buildTimetableHtml(stops, 1, 'STOPPED_AT', 'Route 1\nDowntown');
    expect(html).toContain('First Stop');
    expect(html).toContain('Second Stop');
    expect(html).toContain('Third Stop');
  });

  it('includes the route label as header', () => {
    const html = buildTimetableHtml(stops, 1, 'STOPPED_AT', 'Route 1\nDowntown');
    expect(html).toContain('Route 1<br>Downtown');
  });

  it('highlights current stop when STOPPED_AT', () => {
    const html = buildTimetableHtml(stops, 2, 'STOPPED_AT', 'Test\nRoute');
    expect(html).toContain('<tr class="stop-current">');
    expect(html).not.toContain('stop-previous');
    expect(html).not.toContain('stop-next');
  });

  it('highlights previous and next stops when IN_TRANSIT_TO', () => {
    const html = buildTimetableHtml(stops, 2, 'IN_TRANSIT_TO', 'Test\nRoute');
    expect(html).toContain('<tr class="stop-previous">');
    expect(html).toContain('<tr class="stop-next">');
    expect(html).not.toContain('stop-current');
  });

  it('does not highlight anything for unrelated status', () => {
    const html = buildTimetableHtml(stops, 2, 'UNKNOWN', 'Test\nRoute');
    expect(html).not.toContain('stop-current');
    expect(html).not.toContain('stop-previous');
    expect(html).not.toContain('stop-next');
  });

  it('formats arrival times in the output', () => {
    const html = buildTimetableHtml(stops, 1, 'STOPPED_AT', 'Test\nRoute');
    expect(html).toContain('8:00 AM');
    expect(html).toContain('8:05 AM');
  });
});

describe('indexStopsById', () => {
  it('maps stop_id to stop_name', () => {
    const raw = [
      { stop_id: '100', stop_name: '1st Ave & Spring St' },
      { stop_id: '200', stop_name: 'Broadway & Pine St' },
    ];
    const result = indexStopsById(raw);
    expect(result).toEqual({
      '100': '1st Ave & Spring St',
      '200': 'Broadway & Pine St',
    });
  });

  it('returns empty object for empty input', () => {
    expect(indexStopsById([])).toEqual({});
  });
});

describe('indexStopTimesByTrip', () => {
  const stopsById = { '100': 'Stop A', '200': 'Stop B', '300': 'Stop C' };

  it('groups stop times by trip_id', () => {
    const raw = [
      { trip_id: 'T1', arrival_time: '08:00:00', departure_time: '08:00:00', stop_id: '100', stop_sequence: '1' },
      { trip_id: 'T1', arrival_time: '08:10:00', departure_time: '08:10:00', stop_id: '200', stop_sequence: '2' },
      { trip_id: 'T2', arrival_time: '09:00:00', departure_time: '09:00:00', stop_id: '300', stop_sequence: '1' },
    ];
    const result = indexStopTimesByTrip(raw, stopsById);
    expect(Object.keys(result)).toEqual(['T1', 'T2']);
    expect(result['T1']).toHaveLength(2);
    expect(result['T2']).toHaveLength(1);
  });

  it('sorts stops by stop_sequence', () => {
    const raw = [
      { trip_id: 'T1', arrival_time: '08:10:00', departure_time: '08:10:00', stop_id: '200', stop_sequence: '3' },
      { trip_id: 'T1', arrival_time: '08:00:00', departure_time: '08:00:00', stop_id: '100', stop_sequence: '1' },
      { trip_id: 'T1', arrival_time: '08:05:00', departure_time: '08:05:00', stop_id: '300', stop_sequence: '2' },
    ];
    const result = indexStopTimesByTrip(raw, stopsById);
    expect(result['T1'].map(s => s.stop_sequence)).toEqual([1, 2, 3]);
  });

  it('resolves stop names from stopsById', () => {
    const raw = [
      { trip_id: 'T1', arrival_time: '08:00:00', departure_time: '08:00:00', stop_id: '100', stop_sequence: '1' },
    ];
    const result = indexStopTimesByTrip(raw, stopsById);
    expect(result['T1'][0].stop_name).toBe('Stop A');
  });

  it('falls back to stop_id when stop name is missing', () => {
    const raw = [
      { trip_id: 'T1', arrival_time: '08:00:00', departure_time: '08:00:00', stop_id: '999', stop_sequence: '1' },
    ];
    const result = indexStopTimesByTrip(raw, stopsById);
    expect(result['T1'][0].stop_name).toBe('999');
  });

  it('converts stop_sequence to number', () => {
    const raw = [
      { trip_id: 'T1', arrival_time: '08:00:00', departure_time: '08:00:00', stop_id: '100', stop_sequence: '5' },
    ];
    const result = indexStopTimesByTrip(raw, stopsById);
    expect(result['T1'][0].stop_sequence).toBe(5);
    expect(typeof result['T1'][0].stop_sequence).toBe('number');
  });
});
