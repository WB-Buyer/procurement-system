import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const C = {
  primary: '#C4B1A0', primaryDark: '#A59482', primaryLight: '#EDE5DC',
  border: '#D9CEC5', text: '#3D3530', textMuted: '#A59482', white: '#FFFFFF',
  red: '#B83232', redLight: '#FDEAEA', green: '#1A7A4A', greenLight: '#D9F2E6',
  blue: '#185FA5', blueLight: '#E6F1FB',
}

function generateOrderId(createdAt, seq) {
  const d = new Date(createdAt)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `#${y}${m}${day}-${String(seq).padStart(2, '0')}`
}

function formatDateTime(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  const tw = new Date(d.getTime() + 8 * 60 * 60 * 1000)
  const y = tw.getUTCFullYear()
  const mo = String(tw.getUTCMonth() + 1).padStart(2, '0')
  const day = String(tw.getUTCDate()).padStart(2, '0')
  const h = String(tw.getUTCHours()).padStart(2, '0')
  const mi = String(tw.getUTCMinutes()).padStart(2, '0')
  return `${y}/${mo}/${day} ${h}:${mi}`
}

function NoteInput({ reqId, itemId, defaultNote, onSave }) {
  const [val, setVal] = useState(defaultNote || '')
  useEffect(() => { setVal(defaultNote || '') }, [defaultNote])
  return (
    <input
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => onSave(reqId, itemId, val)}
      placeholder="採購說明..."
      style={{ fontSize:11, padding:'4px 8px', border:`1px solid ${C.border}`, borderRadius:5, color:C.text, width:'100%' }}
    />
  )
}

export default function PurchasingApp({ profile, onLogout }) {
  const [nav, setNav] = useState('dashboard')
  const [allReqs, setAllReqs] = useState([])
  const [owners, setOwners] = useState({})
  const [loading, setLoading] = useState(true)
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [expandedIds, setExpandedIds] = useState({})
  const [toast, setToast] = useState('')

  useEffect(() => { fetchAll(); fetchOwners() }, [])

  async function fetchOwners() {
    const { data } = await supabase.from('product_owners').select('store_name, product_id, owner_name')
    const map = {}
    ;(data || []).forEach(o => { map[`${o.store_name}__${o.product_id}`] = o.owner_name })
    setOwners(map)
  }

  function getOwner(storeName, productId) {
    return owners[`${storeName}__${productId}`] || '-'
  }

  async function fetchAll() {
    setLoading(true)
    const { data } = await supabase
      .from('requisitions')
      .select('*, requisition_items(*, products(name, unit, price, category, brand, spec, expiry_info, extra_note))')
      .order('created_at', { ascending: false })
    setAllReqs(data || [])
    setLoading(false)
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  async function saveItemNote(reqId, itemId, note) {
    await supabase.from('requisition_items').update({ purchase_note: note }).eq('id', itemId)
    setAllReqs(prev => prev.map(req => {
      if (req.id !== reqId) return req
      return {
        ...req,
        requisition_items: req.requisition_items.map(i =>
          i.id === itemId ? { ...i, purchase_note: note } : i
        )
      }
    }))
  }

  async function confirmOrder(req) {
    await supabase.from('requisitions').update({ status: 'ordered' }).eq('id', req.id)
    showToast('已確認訂購')
    fetchAll()
  }

  async function rejectOrder(id) {
    if (!rejectReason.trim()) { alert('請填寫退回原因'); return }
    await supabase.from('requisitions').update({ status: 'rejected', reject_reason: rejectReason }).eq('id', id)
    setRejectingId(null); setRejectReason('')
    showToast('已退回，員工可一鍵重加購物車')
    fetchAll()
  }

  function calcTotal(req) {
    return req.requisition_items?.reduce((sum, i) => sum + (i.products?.price || 0) * i.quantity, 0) || 0
  }

  function toggleExpand(id) {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function exportPDF(req, seqIdx) {
    const total = calcTotal(req)
    const orderId = generateOrderId(req.created_at, seqIdx + 1)
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>訂購單 ${orderId}</title><style>body{font-family:'Microsoft JhengHei','微軟正黑體',Arial,sans-serif;padding:40px;color:#3D3530;}h1{font-size:22px;margin-bottom:6px;color:#A59482;}.info{font-size:13px;color:#A59482;margin-bottom:24px;line-height:2;}table{width:100%;border-collapse:collapse;font-size:12px;}th{background:#C4B1A0;color:#fff;padding:8px 10px;text-align:left;}td{padding:8px 10px;border-bottom:1px solid #D9CEC5;color:#3D3530;}tr:nth-child(even) td{background:#F7F3EF;}.total{text-align:right;font-size:15px;font-weight:bold;color:#A59482;margin-top:16px;}.footer{margin-top:40px;font-size:12px;color:#A59482;border-top:1px solid #D9CEC5;padding-top:12px;}@media print{button{display:none;}}</style></head><body><h1>晶緻集團請購系統 — 訂購單</h1><div class="info">成立編號：${orderId}<br>門市：${req.store_name || '-'}<br>送單日期：${req.submit_date || '-'}<br>簽核時間：${formatDateTime(req.approved_at)}<br>狀態：已訂購</div><table><thead><tr><th>品項名稱</th><th>規格</th><th>採購數量</th><th>庫存數量</th><th>備註/請購原因</th><th>單價</th><th>小計</th><th>採購說明</th><th>負責人</th></tr></thead><tbody>${req.requisition_items?.map(i => `<tr><td>${i.products?.name||'-'}</td><td>${i.products?.spec||'-'}</td><td>x${i.quantity} ${i.products?.unit||'-'}</td><td>${i.stock_qty} ${i.stock_unit}</td><td>${i.item_note||'-'}</td><td>NT$ ${(i.products?.price||0).toLocaleString()}</td><td>NT$ ${((i.products?.price||0)*i.quantity).toLocaleString()}</td><td>${i.purchase_note||'-'}</td><td>${owners[req.store_name+'__'+i.product_id]||'-'}</td></tr>`).join('')||''}</tbody></table><div class="total">總金額：NT$ ${total.toLocaleString()}</div><div class="footer">列印日期：${new Date().toLocaleDateString('zh-TW')}</div><br><button onclick="window.print()" style="background:#C4B1A0;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:14px;cursor:pointer;">列印 / 儲存 PDF</button></body></html>`)
    printWindow.document.close()
  }

  function exportExcel(req, seqIdx) {
    const orderId = generateOrderId(req.created_at, seqIdx + 1)
    const total = calcTotal(req)
    const headers = ['品項名稱','規格','採購數量','單位','庫存數量','庫存單位','備註/請購原因','單價','小計','採購說明','負責人']
    const rows = req.requisition_items?.map(i => [
      i.products?.name||'-', i.products?.spec||'-', i.quantity, i.products?.unit||'-',
      i.stock_qty, i.stock_unit, i.item_note||'',
      i.products?.price||0, (i.products?.price||0)*i.quantity, i.purchase_note||'',
      owners[`${req.store_name}__${i.product_id}`]||'-'
    ]) || []
    const infoRows = [
      [`成立編號：${orderId}`],[`門市：${req.store_name||'-'}`],
      [`送單日期：${req.submit_date||'-'}`],[`簽核時間：${formatDateTime(req.approved_at)}`],
      [],headers,...rows,[],[`總金額：NT$ ${total.toLocaleString()}`]
    ]
    const csvContent = infoRows.map(row => row.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `訂購單-${orderId.replace('#','')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const stats = {
    all: allReqs.length,
    pending: allReqs.filter(r => r.status === 'pending').length,
    toOrder: allReqs.filter(r => r.status === 'manager_approved').length,
    ordered: allReqs.filter(r => r.status === 'ordered').length,
    rejected: allReqs.filter(r => r.status === 'rejected').length,
  }

  const [filterProduct, setFilterProduct] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterStore, setFilterStore] = useState('')

  const statusMap = { pending:'待審核', manager_approved:'待採購', ordered:'已訂購', rejected:'已退回' }
  const statusStyle = {
    pending: { bg:'#FEF3D7', color:'#633806' },
    manager_approved: { bg:C.primaryLight, color:C.primaryDark },
    ordered: { bg:C.greenLight, color:C.green },
    rejected: { bg:C.redLight, color:C.red }
  }

  const baseReqs = nav === 'toorder' ? allReqs.filter(r => r.status === 'manager_approved') : allReqs
  const displayReqs = baseReqs.filter(req => {
    const matchProduct = !filterProduct || req.requisition_items?.some(i =>
      i.products?.name?.toLowerCase().includes(filterProduct.toLowerCase()))
    const matchFrom = !filterDateFrom || req.submit_date >= filterDateFrom
    const matchTo = !filterDateTo || req.submit_date <= filterDateTo
    const matchStore = !filterStore || req.store_name === filterStore
    return matchProduct && matchFrom && matchTo && matchStore
  })

  const storeOptions = [...new Set(allReqs.map(r => r.store_name).filter(Boolean))]

  const navItems = [
    { id:'dashboard', icon:'📊', label:'統計儀表板' },
    { id:'toorder', icon:'📥', label:'待採購', badge: stats.toOrder },
    { id:'all', icon:'📋', label:'全部訂單' },
    { id:'report', icon:'📈', label:'採購報表' },
  ]

  const COLS = '1fr 100px 80px 90px 120px 90px 110px 90px'

  const ReqCard = ({ req, idx }) => {
    const s = statusStyle[req.status] || statusStyle.pending
    const total = calcTotal(req)
    const orderId = generateOrderId(req.created_at, idx + 1)
    const items = req.requisition_items || []
    const LIMIT = 5
    const isExpanded = expandedIds[req.id]
    const visibleItems = isExpanded ? items : items.slice(0, LIMIT)
    const hasMore = items.length > LIMIT
    const isActionable = req.status === 'manager_approved'

    return (
      <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12, padding:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:500, color:C.text }}>成立編號：{orderId}</div>
            {(nav === 'toorder' || nav === 'all') && (
              <div style={{ fontSize:12, color:C.textMuted, marginTop:3 }}>簽核時間：{formatDateTime(req.approved_at)}</div>
            )}
            <div style={{ fontSize:12, color:C.textMuted, marginTop:3 }}>門市：{req.store_name}</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:13, fontWeight:500, color:C.blue }}>總金額：NT$ {total.toLocaleString()}</span>
            <span style={{ background:s.bg, color:s.color, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500 }}>{statusMap[req.status]}</span>
          </div>
        </div>

        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:12, color:C.textMuted, marginBottom:6 }}>品項：</div>
          <div style={{ display:'grid', gridTemplateColumns:COLS, gap:6, padding:'5px 10px', background:C.primaryLight, borderRadius:6, marginBottom:4, fontSize:11, color:C.primaryDark, fontWeight:500 }}>
            <span>品項名稱</span>
            <span>規格</span>
            <span style={{ textAlign:'center' }}>採購數量</span>
            <span style={{ textAlign:'center' }}>庫存數量</span>
            <span style={{ textAlign:'center' }}>備註/請購原因</span>
            <span style={{ textAlign:'right' }}>金額</span>
            <span style={{ textAlign:'center' }}>採購說明</span>
            <span style={{ textAlign:'center' }}>負責人</span>
          </div>
          {visibleItems.map((i, ii) => (
            <div key={ii} style={{ display:'grid', gridTemplateColumns:COLS, gap:6, padding:'6px 10px', borderLeft:`2px solid ${C.border}`, marginBottom:3, alignItems:'center' }}>
              <span style={{ fontSize:12, color:C.text }}>{i.products?.name}</span>
              <span style={{ fontSize:11, color:C.textMuted }}>{i.products?.spec || '-'}</span>
              <span style={{ fontSize:12, color:C.text, textAlign:'center' }}>×{i.quantity} {i.products?.unit}</span>
              <span style={{ fontSize:12, color:C.textMuted, textAlign:'center' }}>{i.stock_qty} {i.stock_unit}</span>
              <span style={{ fontSize:11, color:C.textMuted, textAlign:'center', wordBreak:'break-all' }}>{i.item_note || '-'}</span>
              <span style={{ fontSize:12, color:C.blue, fontWeight:500, textAlign:'right' }}>NT$ {((i.products?.price||0)*i.quantity).toLocaleString()}</span>
              {isActionable
                ? <NoteInput key={`${req.id}-${i.id}`} reqId={req.id} itemId={i.id} defaultNote={i.purchase_note||''} onSave={saveItemNote} />
                : <span style={{ fontSize:11, color:C.textMuted, textAlign:'center' }}>{i.purchase_note || '-'}</span>
              }
              {(() => {
                const owner = getOwner(req.store_name, i.product_id)
                if (owner === '-') return <span style={{ fontSize:11, color:C.textMuted, textAlign:'center' }}>-</span>
                const colors = [
                  { bg:'#E6F1FB', dot:'#185FA5', text:'#0C447C' },
                  { bg:'#D9F2E6', dot:'#1A7A4A', text:'#1A4A2E' },
                  { bg:'#EDE5DC', dot:'#A59482', text:'#3D3530' },
                  { bg:'#FEF3D7', dot:'#BA7517', text:'#633806' },
                ]
                const c = colors[owner.charCodeAt(0) % colors.length]
                return (
                  <div style={{ display:'flex', justifyContent:'center' }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:c.bg, color:c.text, padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:500 }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:c.dot, flexShrink:0, display:'inline-block' }}></span>
                      {owner}
                    </span>
                  </div>
                )
              })()}
            </div>
          ))}
          {hasMore && (
            <button onClick={() => toggleExpand(req.id)}
              style={{ background:'transparent', border:`1px solid ${C.border}`, color:C.primaryDark, padding:'4px 12px', borderRadius:20, fontSize:11, cursor:'pointer', marginTop:4 }}>
              {isExpanded ? '▲ 收合' : `▼ 展開全部 ${items.length} 項`}
            </button>
          )}
        </div>

        {req.status === 'rejected' && req.reject_reason && (
          <div style={{ background:C.redLight, color:C.red, padding:'6px 10px', borderRadius:6, fontSize:12, marginBottom:10 }}>退回原因：{req.reject_reason}</div>
        )}

        {req.status === 'manager_approved' && (
          <div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <button onClick={() => confirmOrder(req)} style={{ background:C.blue, color:C.white, border:'none', padding:'7px 16px', borderRadius:7, fontSize:12, cursor:'pointer' }}>確認訂購</button>
              <button onClick={() => exportPDF(req, idx)} style={{ background:C.primaryLight, color:C.text, border:`1px solid ${C.border}`, padding:'7px 16px', borderRadius:7, fontSize:12, cursor:'pointer' }}>輸出 PDF</button>
              <button onClick={() => exportExcel(req, idx)} style={{ background:'#1A7A4A', color:C.white, border:'none', padding:'7px 16px', borderRadius:7, fontSize:12, cursor:'pointer' }}>輸出 Excel</button>
              <button onClick={() => { setRejectingId(rejectingId === req.id ? null : req.id); setRejectReason('') }} style={{ background:C.white, color:C.red, border:'1px solid #F09595', padding:'7px 16px', borderRadius:7, fontSize:12, cursor:'pointer' }}>退回</button>
            </div>
            {rejectingId === req.id && (
              <div style={{ marginTop:10 }}>
                <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="請填寫退回原因..." rows={2}
                  style={{ width:'100%', padding:'8px 10px', border:`1px solid ${C.border}`, borderRadius:7, fontSize:13, resize:'none', color:C.text }} />
                <div style={{ display:'flex', gap:8, marginTop:6 }}>
                  <button onClick={() => rejectOrder(req.id)} style={{ background:C.red, color:C.white, border:'none', padding:'6px 14px', borderRadius:7, fontSize:12, cursor:'pointer' }}>確認退回</button>
                  <button onClick={() => setRejectingId(null)} style={{ background:C.primaryLight, border:`1px solid ${C.border}`, padding:'6px 14px', borderRadius:7, fontSize:12, cursor:'pointer', color:C.text }}>取消</button>
                </div>
              </div>
            )}
          </div>
        )}

        {req.status === 'ordered' && (
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => exportPDF(req, idx)} style={{ background:C.primaryLight, color:C.text, border:`1px solid ${C.border}`, padding:'7px 16px', borderRadius:7, fontSize:12, cursor:'pointer' }}>重新輸出 PDF</button>
            <button onClick={() => exportExcel(req, idx)} style={{ background:'#1A7A4A', color:C.white, border:'none', padding:'7px 16px', borderRadius:7, fontSize:12, cursor:'pointer' }}>重新輸出 Excel</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <Layout profile={profile} onLogout={onLogout} navItems={navItems} activeNav={nav} onNav={setNav}>
      {toast && <div style={{ background:C.text, color:'#fff', padding:'10px 16px', borderRadius:8, fontSize:13, marginBottom:16 }}>{toast}</div>}

      {nav === 'dashboard' && (
        <div>
          <h2 style={{ fontSize:18, fontWeight:700, marginBottom:16, color:C.text }}>統計儀表板</h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:24 }}>
            {[
              { label:'全部', val:stats.all, color:C.text },
              { label:'待審核', val:stats.pending, color:'#854F0B' },
              { label:'待採購', val:stats.toOrder, color:C.blue },
              { label:'已訂購', val:stats.ordered, color:C.green },
              { label:'退回', val:stats.rejected, color:C.red },
            ].map(s => (
              <div key={s.label} style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:10, padding:'14px 16px' }}>
                <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>{s.label}</div>
                <div style={{ fontSize:26, fontWeight:700, color:s.color }}>{s.val}</div>
              </div>
            ))}
          </div>
          <h3 style={{ fontSize:14, fontWeight:500, color:C.textMuted, marginBottom:12 }}>近期請購單</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {allReqs.slice(0,5).map((req, idx) => <ReqCard key={req.id} req={req} idx={idx} />)}
          </div>
        </div>
      )}

      {(nav === 'toorder' || nav === 'all') && (
        <div>
          <h2 style={{ fontSize:18, fontWeight:700, marginBottom:12, color:C.text }}>
            {nav === 'toorder' ? `待採購訂單（${stats.toOrder} 件）` : `全部訂單（${stats.all} 件）`}
          </h2>

          {/* 篩選列 */}
          <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
            <input value={filterProduct} onChange={e => setFilterProduct(e.target.value)}
              placeholder="🔍 搜尋品項名稱..."
              style={{ padding:'7px 12px', border:`1px solid ${C.border}`, borderRadius:7, fontSize:12, color:C.text, width:200 }} />
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:12, color:C.textMuted }}>日期</span>
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                style={{ padding:'7px 10px', border:`1px solid ${C.border}`, borderRadius:7, fontSize:12, color:C.text }} />
              <span style={{ fontSize:12, color:C.textMuted }}>～</span>
              <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                style={{ padding:'7px 10px', border:`1px solid ${C.border}`, borderRadius:7, fontSize:12, color:C.text }} />
            </div>
            <select value={filterStore} onChange={e => setFilterStore(e.target.value)}
              style={{ padding:'7px 12px', border:`1px solid ${C.border}`, borderRadius:7, fontSize:12, color:C.text }}>
              <option value="">所有門市</option>
              {storeOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {(filterProduct || filterDateFrom || filterDateTo || filterStore) && (
              <button onClick={() => { setFilterProduct(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterStore('') }}
                style={{ padding:'7px 12px', border:`1px solid ${C.border}`, borderRadius:7, fontSize:12, color:C.red, background:C.redLight, cursor:'pointer' }}>
                清除篩選
              </button>
            )}
          </div>

          {loading && <div style={{ color:C.textMuted, textAlign:'center', padding:'40px 0' }}>載入中...</div>}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {displayReqs.length === 0 && !loading && <div style={{ color:C.textMuted, textAlign:'center', padding:'40px 0' }}>目前沒有符合條件的訂單</div>}
            {displayReqs.map((req, idx) => <ReqCard key={req.id} req={req} idx={idx} />)}
          </div>
        </div>
      )}
      {nav === 'report' && <ReportPage allReqs={allReqs} />}
    </Layout>
  )
}

function ReportPage({ allReqs }) {
  const C = {
    primary: '#C4B1A0', primaryDark: '#A59482', primaryLight: '#EDE5DC',
    border: '#D9CEC5', text: '#3D3530', textMuted: '#A59482', white: '#FFFFFF',
    red: '#B83232', redLight: '#FDEAEA', green: '#1A7A4A', greenLight: '#D9F2E6',
    blue: '#185FA5',
  }

  const [dateFrom, setDateFrom] = React.useState('')
  const [dateTo, setDateTo] = React.useState('')
  const [selectedStores, setSelectedStores] = React.useState([])
  const [selectedProducts, setSelectedProducts] = React.useState([])
  const [reportType, setReportType] = React.useState('detail')
  const [reportData, setReportData] = React.useState(null)

  const storeOptions = [...new Set(allReqs.map(r => r.store_name).filter(Boolean))].sort()
  const productOptions = [...new Set(
    allReqs.flatMap(r => r.requisition_items?.map(i => i.products?.name) || []).filter(Boolean)
  )].sort()

  function toggleStore(s) {
    setSelectedStores(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }
  function toggleProduct(p) {
    setSelectedProducts(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  function generateReport() {
    const filtered = allReqs.filter(req => {
      const matchFrom = !dateFrom || req.submit_date >= dateFrom
      const matchTo = !dateTo || req.submit_date <= dateTo
      const matchStore = selectedStores.length === 0 || selectedStores.includes(req.store_name)
      return matchFrom && matchTo && matchStore
    })

    const rows = []
    filtered.forEach(req => {
      req.requisition_items?.forEach(i => {
        const pname = i.products?.name || '-'
        if (selectedProducts.length > 0 && !selectedProducts.includes(pname)) return
        rows.push({
          date: req.submit_date || '-',
          store: req.store_name || '-',
          product: pname,
          spec: i.products?.spec || '-',
          unit: i.products?.unit || '-',
          qty: i.quantity,
          price: i.products?.price || 0,
          total: (i.products?.price || 0) * i.quantity,
          status: req.status,
        })
      })
    })
    setReportData(rows)
  }

  function exportExcel() {
    if (!reportData || reportData.length === 0) { alert('請先產生報表'); return }

    let rows = []
    const label = `日期區間：${dateFrom||'不限'} ～ ${dateTo||'不限'}　門市：${selectedStores.length ? selectedStores.join('、') : '全部'}　品項：${selectedProducts.length ? selectedProducts.join('、') : '全部'}`

    if (reportType === 'detail') {
      rows = [
        [label], [],
        ['日期', '門市', '品項名稱', '規格', '單位', '數量', '單價', '金額'],
        ...reportData.map(r => [r.date, r.store, r.product, r.spec, r.unit, r.qty, r.price, r.total]),
        [],
        ['合計', '', '', '', '', reportData.reduce((s,r)=>s+r.qty,0), '', reportData.reduce((s,r)=>s+r.total,0)]
      ]
    } else if (reportType === 'summary') {
      const map = {}
      reportData.forEach(r => {
        const k = `${r.product}__${r.unit}`
        if (!map[k]) map[k] = { product: r.product, spec: r.spec, unit: r.unit, qty: 0, total: 0 }
        map[k].qty += r.qty
        map[k].total += r.total
      })
      rows = [
        [label], [],
        ['品項名稱', '規格', '單位', '總數量', '總金額'],
        ...Object.values(map).map(r => [r.product, r.spec, r.unit, r.qty, r.total]),
        [],
        ['合計', '', '', Object.values(map).reduce((s,r)=>s+r.qty,0), Object.values(map).reduce((s,r)=>s+r.total,0)]
      ]
    } else if (reportType === 'cross') {
      const stores = [...new Set(reportData.map(r => r.store))].sort()
      const products = [...new Set(reportData.map(r => r.product))].sort()
      const map = {}
      reportData.forEach(r => {
        if (!map[r.product]) map[r.product] = {}
        map[r.product][r.store] = (map[r.product][r.store] || 0) + r.qty
      })
      rows = [
        [label], [],
        ['品項名稱', ...stores, '合計'],
        ...products.map(p => [
          p,
          ...stores.map(s => map[p]?.[s] || 0),
          stores.reduce((sum, s) => sum + (map[p]?.[s] || 0), 0)
        ]),
        ['合計', ...stores.map(s => products.reduce((sum,p)=>sum+(map[p]?.[s]||0),0)),
          reportData.reduce((s,r)=>s+r.qty,0)]
      ]
    }

    const csv = rows.map(row => row.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type:'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const typeLabel = { detail:'明細表', summary:'彙總表', cross:'交叉分析表' }[reportType]
    a.download = `採購報表_${typeLabel}_${dateFrom||'全期'}_${dateTo||''}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const detailTotal = reportData ? reportData.reduce((s,r)=>s+r.total,0) : 0
  const detailQty = reportData ? reportData.reduce((s,r)=>s+r.qty,0) : 0

  return (
    <div>
      <h2 style={{ fontSize:18, fontWeight:700, marginBottom:16, color:C.text }}>採購報表</h2>

      <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12, padding:20, marginBottom:16 }}>
        <div style={{ fontWeight:500, fontSize:13, color:C.text, marginBottom:14 }}>篩選條件</div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div>
            <label style={{ fontSize:12, color:C.textMuted, display:'block', marginBottom:6 }}>日期區間</label>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                style={{ flex:1, padding:'7px 10px', border:`1px solid ${C.border}`, borderRadius:7, fontSize:12, color:C.text }} />
              <span style={{ color:C.textMuted, fontSize:12 }}>～</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                style={{ flex:1, padding:'7px 10px', border:`1px solid ${C.border}`, borderRadius:7, fontSize:12, color:C.text }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize:12, color:C.textMuted, display:'block', marginBottom:6 }}>報表類型</label>
            <div style={{ display:'flex', gap:8 }}>
              {[['detail','明細表'],['summary','彙總表'],['cross','交叉分析表']].map(([val,label]) => (
                <button key={val} onClick={() => setReportType(val)}
                  style={{ padding:'6px 14px', borderRadius:7, fontSize:12, cursor:'pointer', border:'1px solid',
                    background: reportType === val ? C.primary : C.white,
                    color: reportType === val ? C.white : C.textMuted,
                    borderColor: reportType === val ? C.primary : C.border }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize:12, color:C.textMuted, display:'block', marginBottom:6 }}>門市（可複選，不選表示全部）</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {storeOptions.map(s => (
                <button key={s} onClick={() => toggleStore(s)}
                  style={{ padding:'4px 12px', borderRadius:20, fontSize:11, cursor:'pointer', border:'1px solid',
                    background: selectedStores.includes(s) ? C.primary : C.white,
                    color: selectedStores.includes(s) ? C.white : C.textMuted,
                    borderColor: selectedStores.includes(s) ? C.primary : C.border }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize:12, color:C.textMuted, display:'block', marginBottom:6 }}>品項（可複選，不選表示全部）</label>
            <div style={{ position:'relative' }}>
              <div
                onClick={() => document.getElementById('product-dropdown').classList.toggle('open')}
                style={{ padding:'7px 12px', border:`1px solid ${C.border}`, borderRadius:7, fontSize:12, color: selectedProducts.length ? C.text : C.textMuted, cursor:'pointer', background:C.white, userSelect:'none', display:'flex', justifyContent:'space-between', alignItems:'center', minWidth:300 }}>
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
                  {selectedProducts.length === 0 ? '全部品項' : selectedProducts.join('、')}
                </span>
                <span style={{ marginLeft:8, color:C.textMuted, fontSize:10 }}>▼</span>
              </div>
              <div id="product-dropdown"
                style={{ display:'none', position:'absolute', top:'100%', left:0, right:0, background:C.white, border:`1px solid ${C.border}`, borderRadius:7, zIndex:100, maxHeight:240, overflowY:'auto', boxShadow:'0 4px 12px rgba(0,0,0,0.1)', marginTop:2 }}
                className="product-dropdown-menu">
                <style>{`.product-dropdown-menu.open { display: block !important; }`}</style>
                <div style={{ padding:'6px 10px', borderBottom:`1px solid ${C.border}`, display:'flex', gap:8 }}>
                  <button onClick={e => { e.stopPropagation(); setSelectedProducts([]) }}
                    style={{ fontSize:11, padding:'2px 10px', borderRadius:20, border:`1px solid ${C.border}`, cursor:'pointer', background: selectedProducts.length === 0 ? C.blue : C.white, color: selectedProducts.length === 0 ? C.white : C.textMuted }}>
                    全部
                  </button>
                  <span style={{ fontSize:11, color:C.textMuted, alignSelf:'center' }}>已選 {selectedProducts.length} 項</span>
                </div>
                {productOptions.map(p => (
                  <div key={p} onClick={e => { e.stopPropagation(); toggleProduct(p) }}
                    style={{ padding:'7px 12px', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:8,
                      background: selectedProducts.includes(p) ? '#F0F7FF' : C.white,
                      color: selectedProducts.includes(p) ? C.blue : C.text }}>
                    <span style={{ width:14, height:14, border:`1.5px solid ${selectedProducts.includes(p) ? C.blue : C.border}`, borderRadius:3, background: selectedProducts.includes(p) ? C.blue : C.white, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {selectedProducts.includes(p) && <span style={{ color:C.white, fontSize:9, lineHeight:1 }}>✓</span>}
                    </span>
                    {p}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display:'flex', gap:10, marginTop:16 }}>
          <button onClick={generateReport}
            style={{ background:C.primary, color:C.white, border:'none', padding:'9px 24px', borderRadius:8, fontSize:13, cursor:'pointer', fontWeight:500 }}>
            產生報表
          </button>
          {reportData && (
            <button onClick={exportExcel}
              style={{ background:'#1A7A4A', color:C.white, border:'none', padding:'9px 24px', borderRadius:8, fontSize:13, cursor:'pointer' }}>
              輸出 Excel
            </button>
          )}
          {(dateFrom || dateTo || selectedStores.length > 0 || selectedProducts.length > 0) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); setSelectedStores([]); setSelectedProducts([]); setReportData(null) }}
              style={{ background:C.redLight, color:C.red, border:`1px solid ${C.border}`, padding:'9px 16px', borderRadius:8, fontSize:13, cursor:'pointer' }}>
              清除
            </button>
          )}
        </div>
      </div>

      {reportData && (
        <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:500, color:C.text }}>
              {{ detail:'明細表', summary:'彙總表', cross:'各門市採購量交叉分析表' }[reportType]}
              <span style={{ fontSize:11, color:C.textMuted, marginLeft:10 }}>
                共 {reportData.length} 筆　總數量：{detailQty}　總金額：NT$ {detailTotal.toLocaleString()}
              </span>
            </div>
          </div>

          {reportType === 'detail' && (
            <div style={{ overflowX:'auto' }}>
              <div style={{ display:'grid', gridTemplateColumns:'100px 120px 1fr 100px 60px 60px 80px 90px', gap:6, padding:'5px 10px', background:C.primaryLight, borderRadius:6, marginBottom:4, fontSize:11, color:C.primaryDark, fontWeight:500, minWidth:700 }}>
                <span>日期</span><span>門市</span><span>品項名稱</span><span>規格</span><span style={{textAlign:'center'}}>單位</span><span style={{textAlign:'center'}}>數量</span><span style={{textAlign:'right'}}>單價</span><span style={{textAlign:'right'}}>金額</span>
              </div>
              {reportData.map((r, idx) => (
                <div key={idx} style={{ display:'grid', gridTemplateColumns:'100px 120px 1fr 100px 60px 60px 80px 90px', gap:6, padding:'5px 10px', borderLeft:`2px solid ${C.border}`, marginBottom:2, fontSize:11, color:C.text, minWidth:700, background: idx%2===0?'#FAF7F5':C.white }}>
                  <span>{r.date}</span><span>{r.store}</span><span>{r.product}</span><span style={{color:C.textMuted}}>{r.spec}</span>
                  <span style={{textAlign:'center'}}>{r.unit}</span><span style={{textAlign:'center'}}>{r.qty}</span>
                  <span style={{textAlign:'right'}}>NT$ {r.price.toLocaleString()}</span>
                  <span style={{textAlign:'right',color:C.blue,fontWeight:500}}>NT$ {r.total.toLocaleString()}</span>
                </div>
              ))}
              <div style={{ display:'grid', gridTemplateColumns:'100px 120px 1fr 100px 60px 60px 80px 90px', gap:6, padding:'6px 10px', background:C.primaryLight, borderRadius:6, marginTop:4, fontSize:11, fontWeight:500, color:C.text, minWidth:700 }}>
                <span>合計</span><span></span><span></span><span></span><span></span>
                <span style={{textAlign:'center',color:C.blue}}>{detailQty}</span><span></span>
                <span style={{textAlign:'right',color:C.blue}}>NT$ {detailTotal.toLocaleString()}</span>
              </div>
            </div>
          )}

          {reportType === 'summary' && (() => {
            const map = {}
            reportData.forEach(r => {
              const k = `${r.product}__${r.unit}`
              if (!map[k]) map[k] = { product:r.product, spec:r.spec, unit:r.unit, qty:0, total:0 }
              map[k].qty += r.qty; map[k].total += r.total
            })
            const rows = Object.values(map)
            return (
              <div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 120px 60px 80px 100px', gap:6, padding:'5px 10px', background:C.primaryLight, borderRadius:6, marginBottom:4, fontSize:11, color:C.primaryDark, fontWeight:500 }}>
                  <span>品項名稱</span><span>規格</span><span style={{textAlign:'center'}}>單位</span><span style={{textAlign:'center'}}>總數量</span><span style={{textAlign:'right'}}>總金額</span>
                </div>
                {rows.map((r, idx) => (
                  <div key={idx} style={{ display:'grid', gridTemplateColumns:'1fr 120px 60px 80px 100px', gap:6, padding:'5px 10px', borderLeft:`2px solid ${C.border}`, marginBottom:2, fontSize:11, color:C.text, background: idx%2===0?'#FAF7F5':C.white }}>
                    <span>{r.product}</span><span style={{color:C.textMuted}}>{r.spec}</span>
                    <span style={{textAlign:'center'}}>{r.unit}</span>
                    <span style={{textAlign:'center',color:C.blue,fontWeight:500}}>{r.qty}</span>
                    <span style={{textAlign:'right',color:C.blue,fontWeight:500}}>NT$ {r.total.toLocaleString()}</span>
                  </div>
                ))}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 120px 60px 80px 100px', gap:6, padding:'6px 10px', background:C.primaryLight, borderRadius:6, marginTop:4, fontSize:11, fontWeight:500, color:C.text }}>
                  <span>合計</span><span></span><span></span>
                  <span style={{textAlign:'center',color:C.blue}}>{rows.reduce((s,r)=>s+r.qty,0)}</span>
                  <span style={{textAlign:'right',color:C.blue}}>NT$ {rows.reduce((s,r)=>s+r.total,0).toLocaleString()}</span>
                </div>
              </div>
            )
          })()}

          {reportType === 'cross' && (() => {
            const stores = [...new Set(reportData.map(r => r.store))].sort()
            const products = [...new Set(reportData.map(r => r.product))].sort()
            const map = {}
            reportData.forEach(r => {
              if (!map[r.product]) map[r.product] = {}
              map[r.product][r.store] = (map[r.product][r.store] || 0) + r.qty
            })
            const colW = `1fr ${stores.map(()=>'80px').join(' ')} 80px`
            return (
              <div style={{ overflowX:'auto' }}>
                <div style={{ display:'grid', gridTemplateColumns:colW, gap:6, padding:'5px 10px', background:C.primaryLight, borderRadius:6, marginBottom:4, fontSize:11, color:C.primaryDark, fontWeight:500, minWidth:400 }}>
                  <span>品項名稱</span>
                  {stores.map(s => <span key={s} style={{textAlign:'center'}}>{s}</span>)}
                  <span style={{textAlign:'center'}}>合計</span>
                </div>
                {products.map((p, idx) => (
                  <div key={idx} style={{ display:'grid', gridTemplateColumns:colW, gap:6, padding:'5px 10px', borderLeft:`2px solid ${C.border}`, marginBottom:2, fontSize:11, color:C.text, background: idx%2===0?'#FAF7F5':C.white, minWidth:400 }}>
                    <span>{p}</span>
                    {stores.map(s => <span key={s} style={{textAlign:'center',color: map[p]?.[s] ? C.blue : C.textMuted}}>{map[p]?.[s] || '-'}</span>)}
                    <span style={{textAlign:'center',fontWeight:500,color:C.blue}}>{stores.reduce((sum,s)=>sum+(map[p]?.[s]||0),0)}</span>
                  </div>
                ))}
                <div style={{ display:'grid', gridTemplateColumns:colW, gap:6, padding:'6px 10px', background:C.primaryLight, borderRadius:6, marginTop:4, fontSize:11, fontWeight:500, color:C.text, minWidth:400 }}>
                  <span>合計</span>
                  {stores.map(s => <span key={s} style={{textAlign:'center',color:C.blue}}>{products.reduce((sum,p)=>sum+(map[p]?.[s]||0),0)}</span>)}
                  <span style={{textAlign:'center',color:C.blue}}>{reportData.reduce((s,r)=>s+r.qty,0)}</span>
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
