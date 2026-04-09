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

  const statusMap = { pending:'待審核', manager_approved:'待採購', ordered:'已訂購', rejected:'已退回' }
  const statusStyle = {
    pending: { bg:'#FEF3D7', color:'#633806' },
    manager_approved: { bg:C.primaryLight, color:C.primaryDark },
    ordered: { bg:C.greenLight, color:C.green },
    rejected: { bg:C.redLight, color:C.red }
  }

  const displayReqs = nav === 'toorder' ? allReqs.filter(r => r.status === 'manager_approved') : allReqs
  const navItems = [
    { id:'dashboard', icon:'📊', label:'統計儀表板' },
    { id:'toorder', icon:'📥', label:'待採購', badge: stats.toOrder },
    { id:'all', icon:'📋', label:'全部訂單' },
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
          <h2 style={{ fontSize:18, fontWeight:700, marginBottom:16, color:C.text }}>
            {nav === 'toorder' ? `待採購訂單（${stats.toOrder} 件）` : `全部訂單（${stats.all} 件）`}
          </h2>
          {loading && <div style={{ color:C.textMuted, textAlign:'center', padding:'40px 0' }}>載入中...</div>}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {displayReqs.length === 0 && !loading && <div style={{ color:C.textMuted, textAlign:'center', padding:'40px 0' }}>目前沒有訂單</div>}
            {displayReqs.map((req, idx) => <ReqCard key={req.id} req={req} idx={idx} />)}
          </div>
        </div>
      )}
    </Layout>
  )
}
