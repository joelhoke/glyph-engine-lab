type RangeControlProps = {
  label: string
  id?: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (value: number) => void
}

export default function RangeControl({
  label,
  id,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
}: RangeControlProps) {
  return (
    <label htmlFor={id}>
      {label}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span>{value}{suffix}</span>
    </label>
  )
}
