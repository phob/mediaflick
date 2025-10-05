import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Row } from "@/lib/api/types"

export function useRowSelection(rows: Row[]) {
  const [selectedKeys, setSelectedKeys] = useState<Set<number>>(new Set())
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null)
  const [preDragSelectedKeys, setPreDragSelectedKeys] = useState<Set<number>>(new Set())
  const [dragMode, setDragMode] = useState<"select" | "deselect">("select")
  const isDraggingRef = useRef(false)
  const didDragRef = useRef(false)

  const keyToIndex = useMemo(() => {
    const map = new Map<number, number>()
    rows.forEach((row, index) => map.set(row.key, index))
    return map
  }, [rows])

  const handleRowClick = useCallback((e: React.MouseEvent, key: number) => {
    // If a drag just happened, skip click toggle
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }

    const clickedIndex = keyToIndex.get(key) ?? null

    if (e.shiftKey && lastSelectedIndex !== null && clickedIndex !== null) {
      const start = Math.min(lastSelectedIndex, clickedIndex)
      const end = Math.max(lastSelectedIndex, clickedIndex)
      const rangeKeys = rows.slice(start, end + 1).map((r) => r.key)
      const newKeys = new Set(selectedKeys)
      rangeKeys.forEach((k) => newKeys.add(k))
      setSelectedKeys(newKeys)
    } else {
      const newKeys = new Set(selectedKeys)
      if (newKeys.has(key)) {
        newKeys.delete(key)
      } else {
        newKeys.add(key)
      }
      setSelectedKeys(newKeys)
      if (clickedIndex !== null) setLastSelectedIndex(clickedIndex)
    }
  }, [keyToIndex, lastSelectedIndex, rows, selectedKeys])

  const updateDragSelection = useCallback((currentIndex: number) => {
    if (dragStartIndex === null) return
    const start = Math.min(dragStartIndex, currentIndex)
    const end = Math.max(dragStartIndex, currentIndex)
    const rangeKeys = rows.slice(start, end + 1).map((r) => r.key)
    const newSet = new Set(preDragSelectedKeys)
    if (dragMode === "select") {
      rangeKeys.forEach((k) => newSet.add(k))
    } else {
      rangeKeys.forEach((k) => newSet.delete(k))
    }
    setSelectedKeys(newSet)
  }, [dragStartIndex, dragMode, preDragSelectedKeys, rows])

  const handleMouseDown = useCallback((e: React.MouseEvent, itemKey: number) => {
    // Only left button
    if (e.button !== 0) return
    // Don't start drag if interacting with controls
    if (
      e.target instanceof HTMLElement &&
      (e.target.closest("button") || e.target.closest("a") || e.target.closest("input"))
    ) {
      return
    }
    const index = keyToIndex.get(itemKey)
    if (index === undefined) return
    isDraggingRef.current = true
    didDragRef.current = false
    setIsDragging(true)
    setDragStartIndex(index)
    setPreDragSelectedKeys(new Set(selectedKeys))
    setDragMode(selectedKeys.has(itemKey) ? "deselect" : "select")
    setLastSelectedIndex(index)
  }, [keyToIndex, selectedKeys])

  const handleMouseEnter = useCallback((itemKey: number) => {
    if (!isDraggingRef.current) return
    const index = keyToIndex.get(itemKey)
    if (index === undefined || dragStartIndex === null) return
    if (index !== dragStartIndex) didDragRef.current = true
    updateDragSelection(index)
  }, [keyToIndex, dragStartIndex, updateDragSelection])

  const handleSelectAll = useCallback((checked: boolean) => {
    const newKeys = checked ? new Set<number>(rows.map(row => row.key)) : new Set<number>()
    setSelectedKeys(newKeys)
  }, [rows])

  const handleCheckboxChange = useCallback((itemKey: number, checked: boolean) => {
    const newKeys = new Set(selectedKeys)
    if (checked) {
      newKeys.add(itemKey)
    } else {
      newKeys.delete(itemKey)
    }
    setSelectedKeys(newKeys)
  }, [selectedKeys])

  // Handle mouse up globally
  useEffect(() => {
    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        setIsDragging(false)
        setDragStartIndex(null)
        setPreDragSelectedKeys(new Set())
      }
    }
    window.addEventListener("mouseup", handleMouseUp)
    return () => window.removeEventListener("mouseup", handleMouseUp)
  }, [])

  return {
    selectedKeys,
    setSelectedKeys,
    handleRowClick,
    handleMouseDown,
    handleMouseEnter,
    handleSelectAll,
    handleCheckboxChange,
    isDragging,
    didDragRef,
  }
}
