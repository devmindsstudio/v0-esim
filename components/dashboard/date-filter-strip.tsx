'use client'

import { useState } from 'react'
import { CalendarIcon, X } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const years = Array.from({ length: 5 }, (_, i) => 2026 - i)
const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

interface DateFilterStripProps {
  onDateChange?: (from: Date | undefined, to: Date | undefined) => void
}

export function DateFilterStrip({ onDateChange }: DateFilterStripProps) {
  const [fromDate, setFromDate] = useState<Date | undefined>()
  const [toDate, setToDate] = useState<Date | undefined>()
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')

  const handleClear = () => {
    setFromDate(undefined)
    setToDate(undefined)
    setSelectedYear('')
    setSelectedMonth('')
    onDateChange?.(undefined, undefined)
  }

  // Build a range from a year (+ optional month) and push it up. Year alone →
  // the whole year; year + month → that single month.
  const emitYearMonth = (year: string, month: string) => {
    if (!year) return
    const y = parseInt(year, 10)
    const from = month ? new Date(y, months.indexOf(month), 1) : new Date(y, 0, 1)
    const to = month ? new Date(y, months.indexOf(month) + 1, 0) : new Date(y, 11, 31)
    setFromDate(from)
    setToDate(to)
    onDateChange?.(from, to)
  }

  const handleYearChange = (year: string) => {
    setSelectedYear(year)
    emitYearMonth(year, selectedMonth)
  }

  const handleMonthChange = (month: string) => {
    // Picking a month without a year defaults to the most recent year, and we
    // reflect that back in the Year dropdown so the selection is unambiguous.
    const year = selectedYear || String(years[0])
    if (!selectedYear) setSelectedYear(year)
    setSelectedMonth(month)
    emitYearMonth(year, month)
  }

  const handleFromDateChange = (date: Date | undefined) => {
    setFromDate(date)
    setSelectedYear('')
    setSelectedMonth('')
    onDateChange?.(date, toDate)
  }

  const handleToDateChange = (date: Date | undefined) => {
    setToDate(date)
    setSelectedYear('')
    setSelectedMonth('')
    onDateChange?.(fromDate, date)
  }

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-card rounded-lg border shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">From:</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'w-32 justify-start text-left font-normal',
                !fromDate && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 size-4" />
              {fromDate ? format(fromDate, 'dd/MM/yyyy') : 'dd/mm/yyyy'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={fromDate}
              onSelect={handleFromDateChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">To:</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'w-32 justify-start text-left font-normal',
                !toDate && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 size-4" />
              {toDate ? format(toDate, 'dd/MM/yyyy') : 'dd/mm/yyyy'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={toDate}
              onSelect={handleToDateChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Year:</span>
        <Select value={selectedYear} onValueChange={handleYearChange}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Select Year" />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Month:</span>
        <Select value={selectedMonth} onValueChange={handleMonthChange}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Select Month" />
          </SelectTrigger>
          <SelectContent>
            {months.map((month) => (
              <SelectItem key={month} value={month}>
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        variant="default"
        size="sm"
        onClick={handleClear}
        className="gap-1"
      >
        Clear
      </Button>
    </div>
  )
}
