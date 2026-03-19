import { useRef, useState, useCallback, useEffect } from 'react'

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const UploadIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" x2="12" y1="3" y2="15" />
  </svg>
)

export default function ImageUploader({ label, value, onChange }) {
  const fileInputRef = useRef(null)
  const containerRef = useRef(null)
  const [active, setActive] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const dataUrl = await fileToBase64(file)
    onChange(dataUrl)
  }, [onChange])

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) handleFile(file)
        return
      }
    }
  }, [handleFile])

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  useEffect(() => {
    if (!active) return
    const handler = (e) => handlePaste(e)
    document.addEventListener('paste', handler)
    return () => document.removeEventListener('paste', handler)
  }, [active, handlePaste])

  const handleContainerClick = (e) => {
    if (e.target === containerRef.current || e.target.closest('.upload-placeholder')) {
      setActive(true)
    }
  }

  const handleClear = (e) => {
    e.stopPropagation()
    onChange(null)
    setActive(false)
  }

  return (
    <div className="image-uploader">
      <div className="image-uploader-label">{label}</div>
      <div
        ref={containerRef}
        className={`image-uploader-area${active ? ' active' : ''}${dragOver ? ' drag-over' : ''}${value ? ' has-image' : ''}`}
        onClick={handleContainerClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onBlur={() => setActive(false)}
        tabIndex={0}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {value ? (
          <div className="image-preview-wrapper">
            <img src={value} alt={label} className="image-preview" />
            <button className="image-clear-btn" onClick={handleClear} title="清除图片">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" x2="6" y1="6" y2="18" />
                <line x1="6" x2="18" y1="6" y2="18" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="upload-placeholder">
            <div className="upload-icon">
              <UploadIcon />
            </div>
            <div className="upload-text">
              <button type="button" className="upload-btn" onClick={(e) => { e.stopPropagation(); handleClick() }}>
                点击上传
              </button>
              <span> 或拖拽图片到此处</span>
            </div>
            <div className="upload-hint">
              {active ? (
                <span className="active-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  已激活 — Ctrl+V 粘贴图片
                </span>
              ) : (
                '点击此区域激活粘贴功能'
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
