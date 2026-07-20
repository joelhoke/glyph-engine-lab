'use client'

import { FormEvent } from 'react'

type PromptInputProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
}

export default function PromptInput({ value, onChange, onSubmit }: PromptInputProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!value.trim()) return
    onSubmit(value.trim())
  }

  return (
    <form className="prompt-input" onSubmit={handleSubmit}>
      <label className="prompt-label" htmlFor="promptInput">
        Ask anything...
      </label>
      <div className="prompt-row">
        <input
          id="promptInput"
          type="text"
          placeholder="Ask anything..."
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button type="submit" className="prompt-submit">
          Go
        </button>
      </div>
    </form>
  )
}
