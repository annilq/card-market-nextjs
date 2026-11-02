'use client'

// 后台「门店位置」地图选点：在 Leaflet + OpenStreetMap 上点选 / 搜索地址，
// 结果写入 geo（{ lat, lng }），保存时由 Shops 集合的 beforeChange 钩子镜像到 lat / lng。
//
// 对比 Directus 版本：那边要单独建一个 Vue 扩展工程（extensions-sdk 构建 → dist），
// 还要靠数据库触发器把 geo 同步回 lat/lng；Payload 里这就是同仓库的一个 React 组件 + 一个钩子。
//
// 注意：Leaflet 在模块顶层就摸 window，直接 `import L from 'leaflet'` 会让
// Payload 后台页面的 SSR 直接崩（Window is not defined）——所以这里只在浏览器端动态载入。
import { useField } from '@payloadcms/ui'
import type * as LeafletNS from 'leaflet'
import { useEffect, useRef, useState } from 'react'

import 'leaflet/dist/leaflet.css'

type Geo = { lat: number; lng: number }

const DEFAULT_CENTER: Geo = { lat: 35.6762, lng: 139.6503 } // 东京

export function MapPickerField() {
  const { value, setValue } = useField<Geo | null>({ path: 'geo' })
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMap = useRef<LeafletNS.Map | null>(null)
  const marker = useRef<LeafletNS.Marker | null>(null)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)

  const current =
    value && typeof value.lat === 'number' && typeof value.lng === 'number' ? value : DEFAULT_CENTER

  useEffect(() => {
    let disposed = false
    let map: LeafletNS.Map | null = null

    void (async () => {
      const L = (await import('leaflet')).default
      if (disposed || !mapRef.current) return
      const icon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        shadowSize: [41, 41],
      })
      map = L.map(mapRef.current).setView([current.lat, current.lng], 12)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)
      marker.current = L.marker([current.lat, current.lng], { icon, draggable: true }).addTo(map)
      map.on('click', (event: LeafletNS.LeafletMouseEvent) => {
        marker.current?.setLatLng(event.latlng)
        setValue({ lat: Number(event.latlng.lat.toFixed(6)), lng: Number(event.latlng.lng.toFixed(6)) })
      })
      marker.current.on('dragend', () => {
        const position = marker.current?.getLatLng()
        if (position) {
          setValue({ lat: Number(position.lat.toFixed(6)), lng: Number(position.lng.toFixed(6)) })
        }
      })
      leafletMap.current = map
    })()

    return () => {
      disposed = true
      map?.remove()
      leafletMap.current = null
      marker.current = null
    }
    // 只在挂载时建一次地图
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 外部改值（如首次载入已有坐标）时把地图视图挪过去
  useEffect(() => {
    const map = leafletMap.current
    if (!map || !marker.current) return
    marker.current.setLatLng([current.lat, current.lng])
    map.setView([current.lat, current.lng], map.getZoom())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.lat, current.lng])

  const search = async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
      )
      const results = (await response.json()) as { lat: string; lon: string }[]
      if (results[0]) {
        const next = { lat: Number(results[0].lat), lng: Number(results[0].lon) }
        marker.current?.setLatLng([next.lat, next.lng])
        leafletMap.current?.setView([next.lat, next.lng], 16)
        setValue(next)
      }
    } finally {
      setSearching(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          placeholder="搜索地址后回车定位"
          style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--theme-elevation-150)', borderRadius: 4 }}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void search()
            }
          }}
        />
        <button
          type="button"
          disabled={searching}
          onClick={() => void search()}
          style={{ padding: '6px 12px', border: '1px solid var(--theme-elevation-150)', borderRadius: 4 }}
        >
          {searching ? '搜索中…' : '搜索'}
        </button>
      </div>
      <div ref={mapRef} style={{ height: 320, borderRadius: 6, overflow: 'hidden' }} />
      <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>
        点击地图或拖动标记选点；当前坐标 {current.lat.toFixed(5)}, {current.lng.toFixed(5)}
      </p>
    </div>
  )
}

export default MapPickerField
