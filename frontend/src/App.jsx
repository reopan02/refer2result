import { useState, useEffect, useCallback } from 'react'
import ImageUploader from './components/ImageUploader'
import './App.css'

const API_BASE = 'http://localhost:8000'

const STORAGE_KEYS = {
  apiKey: 'r2r_api_key',
  recognizeApiKey: 'r2r_recognize_api_key',
  recognizeModel: 'r2r_recognize_model',
  concurrency: 'r2r_concurrency',
  aspectRatio: 'r2r_aspect_ratio',
  quality: 'r2r_quality',
}

function usePersisted(key, fallback) {
  const [val, setVal] = useState(() => localStorage.getItem(key) || fallback)
  const update = useCallback((v) => { setVal(v); localStorage.setItem(key, v) }, [key])
  return [val, update]
}

export default function App() {
  const [models, setModels] = useState([])
  const [recognizeModels, setRecognizeModels] = useState([])
  const [aspectRatios, setAspectRatios] = useState([])
  const [qualityLevels, setQualityLevels] = useState([])

  const [selectedModel, setSelectedModel] = useState('')
  const [selectedRecognizeModel, updateRecognizeModel] = usePersisted(STORAGE_KEYS.recognizeModel, '')
  const [concurrency, updateConcurrency] = usePersisted(STORAGE_KEYS.concurrency, '1')
  const [aspectRatio, updateAspectRatio] = usePersisted(STORAGE_KEYS.aspectRatio, '1:1')
  const [quality, updateQuality] = usePersisted(STORAGE_KEYS.quality, '1K')
  const [apiKey, updateApiKey] = usePersisted(STORAGE_KEYS.apiKey, '')
  const [recognizeApiKey, updateRecognizeApiKey] = usePersisted(STORAGE_KEYS.recognizeApiKey, '')

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [keysOpen, setKeysOpen] = useState(true)
  const [modelsOpen, setModelsOpen] = useState(true)

  const [targetImage, setTargetImage] = useState(null)
  const [referImage, setReferImage] = useState(null)
  const [resultImages, setResultImages] = useState([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState('')

  const clearLocalKeys = () => {
    localStorage.removeItem(STORAGE_KEYS.apiKey)
    localStorage.removeItem(STORAGE_KEYS.recognizeApiKey)
    updateApiKey('')
    updateRecognizeApiKey('')
  }

  useEffect(() => {
    fetch(`${API_BASE}/api/models`)
      .then(r => r.json())
      .then(data => {
        setModels(data.models || [])
        setRecognizeModels(data.recognize_models || [])
        setAspectRatios(data.aspect_ratios || [])
        setQualityLevels(data.quality_levels || [])
        if (data.models?.length) setSelectedModel(data.models[0])
        if (data.recognize_models?.length && !localStorage.getItem(STORAGE_KEYS.recognizeModel))
          updateRecognizeModel(data.recognize_models[0])
        if (data.aspect_ratios?.length && !localStorage.getItem(STORAGE_KEYS.aspectRatio))
          updateAspectRatio(data.aspect_ratios[0])
        if (data.quality_levels?.length && !localStorage.getItem(STORAGE_KEYS.quality))
          updateQuality(data.quality_levels[0])
      })
      .catch(() => {
        setModels(['gemini-3-pro-image-preview', 'gemini-3.1-flash-image-preview'])
        setRecognizeModels(['gemini-3.1-flash-lite-preview', 'gemini-2.5-flash'])
        setAspectRatios(['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'])
        setQualityLevels(['512px', '1K', '2K', '4K'])
        setSelectedModel('gemini-3-pro-image-preview')
      })
  }, [])

  const handleSubmit = async () => {
    if (!targetImage || !referImage) return setError('请上传目标图和参考图')
    if (!apiKey) return setError('请输入绘图模型 API Key')
    if (!recognizeApiKey) return setError('请输入识别模型 API Key')

    const count = Number(concurrency)
    setLoading(true)
    setError('')
    setResultImages([])
    setProgress({ done: 0, total: count })

    const payload = {
      target_image: targetImage, refer_image: referImage,
      model: selectedModel, api_key: apiKey,
      recognize_model: selectedRecognizeModel, recognize_api_key: recognizeApiKey,
      aspect_ratio: aspectRatio, quality,
    }

    const runOne = async () => {
      const res = await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || '请求失败') }
      const data = await res.json()
      if (!data.image) throw new Error('模型未返回图像结果')
      return data.image
    }

    let doneCount = 0
    const promises = Array.from({ length: count }, () =>
      runOne().then(img => {
        doneCount++
        setProgress(p => ({ ...p, done: doneCount }))
        setResultImages(prev => [...prev, img])
        return img
      }).catch(err => {
        doneCount++
        setProgress(p => ({ ...p, done: doneCount }))
        return err
      })
    )

    const results = await Promise.all(promises)
    const successes = results.filter(r => typeof r === 'string')
    const failures = results.filter(r => r instanceof Error)
    if (!successes.length) setError(failures[0]?.message || '全部生成任务失败')
    else if (failures.length) setError(`部分成功：${successes.length}/${count} 张已生成`)
    setLoading(false)
  }

  const handleDownload = (image, index) => {
    const link = document.createElement('a')
    link.href = image
    link.download = `refer2result_${Date.now()}_${index + 1}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDownloadAll = () => resultImages.forEach((img, i) => handleDownload(img, i))
  const canSubmit = !loading && targetImage && referImage && apiKey && recognizeApiKey

  const ChevronIcon = ({ open }) => (
    <svg className={`chevron ${open ? 'open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
  )

  return (
    <div className="layout">
      {/* Sidebar overlay for mobile */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">设置</span>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" /></svg>
          </button>
        </div>

        {/* 密钥配置 */}
        <div className="sidebar-section">
          <button className="section-toggle" onClick={() => setKeysOpen(!keysOpen)}>
            <svg className="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>
            密钥配置
            <ChevronIcon open={keysOpen} />
          </button>
          {keysOpen && (
            <div className="section-body">
              <label>绘图模型 Key</label>
              <input type="password" placeholder="用于风格迁移" value={apiKey} onChange={e => updateApiKey(e.target.value)} />
              <label>识别模型 Key</label>
              <input type="password" placeholder="用于人物识别" value={recognizeApiKey} onChange={e => updateRecognizeApiKey(e.target.value)} />
              <button type="button" className="clear-keys-btn" onClick={clearLocalKeys}>清空本地 Key</button>
            </div>
          )}
        </div>

        {/* 模型选择 */}
        <div className="sidebar-section">
          <button className="section-toggle" onClick={() => setModelsOpen(!modelsOpen)}>
            <svg className="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" x2="12" y1="22.08" y2="12" /></svg>
            模型选择
            <ChevronIcon open={modelsOpen} />
          </button>
          {modelsOpen && (
            <div className="section-body">
              <label>绘图模型</label>
              <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <label>识别模型</label>
              <select value={selectedRecognizeModel} onChange={e => updateRecognizeModel(e.target.value)}>
                {recognizeModels.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* 参数设置（始终展开） */}
        <div className="sidebar-section">
          <div className="section-toggle section-toggle-static">
            <svg className="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="4" y1="21" y2="14" /><line x1="4" x2="4" y1="10" y2="3" /><line x1="12" x2="12" y1="21" y2="12" /><line x1="12" x2="12" y1="8" y2="3" /><line x1="20" x2="20" y1="21" y2="16" /><line x1="20" x2="20" y1="12" y2="3" /><line x1="1" x2="7" y1="14" y2="14" /><line x1="9" x2="15" y1="8" y2="8" /><line x1="17" x2="23" y1="16" y2="16" /></svg>
            参数设置
          </div>
          <div className="section-body">
            <label>图像比例</label>
            <select value={aspectRatio} onChange={e => updateAspectRatio(e.target.value)}>
              {aspectRatios.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <label>分辨率</label>
            <select value={quality} onChange={e => updateQuality(e.target.value)}>
              {qualityLevels.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
            <label>并发数量</label>
            <select value={concurrency} onChange={e => updateConcurrency(e.target.value)}>
              {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} 张</option>)}
            </select>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="main">
        <header className="app-header">
          <div className="header-left">
            <button className="menu-btn" onClick={() => setSidebarOpen(true)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" /></svg>
            </button>
            <h1>Refer2Result</h1>
          </div>
          <p className="app-subtitle">基于参考图风格的 AI 图像重绘工具</p>
        </header>

        {/* 图像上传 */}
        <div className="card">
          <div className="card-title">
            <svg className="card-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
            图像上传
          </div>
          <div className="images-section">
            <ImageUploader label="目标图 (Target)" value={targetImage} onChange={setTargetImage} />
            <ImageUploader label="参考图 (Reference)" value={referImage} onChange={setReferImage} />
          </div>
        </div>

        {/* 提交 */}
        <div className="action-section">
          <button className="submit-btn" onClick={handleSubmit} disabled={!canSubmit}>
            {loading ? (
              <><span className="spinner" />生成中 {progress.done}/{progress.total}</>
            ) : (
              <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" /></svg>开始风格迁移</>
            )}
          </button>
        </div>

        {/* 错误 */}
        {error && !error.startsWith('部分成功') && (
          <div className="error-msg">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
            {error}
          </div>
        )}

        {/* 流式结果 */}
        {(resultImages.length > 0 || (loading && progress.total > 0)) && (
          <div className="card result-section">
            <div className="card-title">
              <svg className="card-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.801 10A10 10 0 1 1 17 3.335" /><path d="m9 11 3 3L22 4" /></svg>
              生成结果{resultImages.length > 0 && `（${resultImages.length} 张）`}
            </div>
            <div className="results-grid">
              {resultImages.map((img, idx) => (
                <div key={`${idx}-${img.slice(0, 32)}`} className="result-item result-item-enter">
                  <div className="result-image-wrapper">
                    <img src={img} alt={`结果 ${idx + 1}`} className="result-image" />
                  </div>
                  <button type="button" className="download-btn" onClick={() => handleDownload(img, idx)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                    下载
                  </button>
                </div>
              ))}
              {loading && Array.from({ length: progress.total - resultImages.length }, (_, i) => (
                <div key={`pending-${i}`} className="result-item result-item-pending">
                  <div className="result-placeholder"><span className="spinner spinner-lg" /><span>生成中...</span></div>
                </div>
              ))}
            </div>
            {resultImages.length > 1 && !loading && (
              <div className="action-section" style={{ marginTop: 16 }}>
                <button type="button" className="submit-btn" onClick={handleDownloadAll}>下载全部</button>
              </div>
            )}
            {error.startsWith('部分成功') && <div className="warning-msg">{error}</div>}
          </div>
        )}
      </main>
    </div>
  )
}
