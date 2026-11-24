import { describe as group, expect, it } from 'vitest'
import { describe, parseWeather, rainSoon } from '@/data/weather'

const body = {
  current: { time: '2026-11-24T16:30', temperature_2m: 20.4, apparent_temperature: 19.4, weather_code: 3, wind_speed_10m: 14.2, is_day: 1 },
  hourly: {
    time: ['2026-11-24T16:00', '2026-11-24T17:00', '2026-11-24T18:00', '2026-11-24T19:00', '2026-11-24T20:00', '2026-11-24T21:00', '2026-11-24T22:00', '2026-11-24T23:00'],
    temperature_2m: [20.6, 20.1, 19.8, 19.6, 19.1, 18.4, 18.5, 18.2],
    precipitation_probability: [0, 10, 60, null, 0, 0, 0, 0],
    weather_code: [3, 3, 61, 3, 3, 51, 3, 3],
  },
}

group('parseWeather', () => {
  it('hiện tại + các giờ SAU giờ hiện tại, tối đa 6', () => {
    const w = parseWeather(body)!
    expect(w.now).toEqual({ temp: 20.4, feels: 19.4, code: 3, windKmh: 14.2, isDay: true })
    expect(w.hours.map((h) => h.hour)).toEqual([17, 18, 19, 20, 21, 22])
    expect(w.hours[2].rainPct).toBeNull()
  })
  it('thiếu dữ liệu hiện tại → null', () => {
    expect(parseWeather({})).toBeNull()
    expect(parseWeather({ current: { temperature_2m: 20 } })).toBeNull()
  })
})

group('rainSoon', () => {
  it('giờ đầu trong 3 giờ tới có mưa ≥ 50%', () => {
    expect(rainSoon(parseWeather(body)!)?.hour).toBe(18)
    const dry = { ...body, hourly: { ...body.hourly, precipitation_probability: [0, 0, 0, 0, 90, 0, 0, 0] } }
    expect(rainSoon(parseWeather(dry)!)).toBeNull() // 20h nằm ngoài 3 giờ tới
  })
})

group('describe (mã WMO)', () => {
  it('ngày / đêm, mưa, dông', () => {
    expect(describe(0, true).icon).toBe('sun')
    expect(describe(0, false).icon).toBe('moon')
    expect(describe(61).icon).toBe('rain')
    expect(describe(65).label).toBe('Mưa to')
    expect(describe(95).icon).toBe('storm')
    expect(describe(53).icon).toBe('drizzle')
  })
})
