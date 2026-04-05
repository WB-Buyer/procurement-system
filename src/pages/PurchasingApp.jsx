import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function PurchasingApp({ profile, onLogout }) {
  const [nav, setNav] = useState('dashboard')
  const [allReqs, setAllReqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data } = await supabase
      .from('requisitions')
      .select('*, requisition_items(*, products(name, unit, price, category))')
      .order('created_at', { ascending: false })
    setAllReqs(data || [])
    setLoading(false)
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  async function confirmOrder(id) {
    await supabase.from('requisitions').update({ status: 'ordered' }).eq('id', id)
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

  async function exportPDF(req) {
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF()

    doc.setFont('helvetica')
    doc.setFontSize(16)
    doc.text('Purchase Order', 14, 20)
    doc.setFontSize(10)
    doc.text(`Order ID: ${req.id.slice(0,8).toUpperCase()}`, 14, 30)
    doc.text(`Store: ${req.store_name || '-'}`, 14, 37)
    doc.text(`Date: ${req.submit_date || '-'}`, 14, 44)
    doc.text(`Status: Ordered`, 14, 51)

    const rows = req.requisition_items?.map(i => [
      i.products?.name || '-',
      i.products?.category || '-',
      i.quantity,
      i.products?.unit || '-',
      `NT$ ${(i.products?.price || 0).toLocaleString()}`,
      `NT$ ${((i.products?.price || 0) * i.quantity).toLocaleString()}`,
      `${i.stock_qty} ${i.stock_unit}`,
      i.item_note || '-'
    ]) || []

    autoTable(doc, {
      startY: 58,
      head: [['品項名稱', '類別', '數量', '單位', '單價', '小計', '庫存', '備註']],
      body: rows,
      foot: [[{ content: `總計：NT$ ${calcTotal(req).toLocaleString()}`, colSpan: 8, styles: { halign: 'right', fontStyle: 'bold' } }]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [13, 126, 126] }
    })

    doc.save(`order-${req.id.slice(0,8)}.pdf`)
  }

  const stats = {
    all: allReqs.length,
    pending: allReqs.filter(r => r.status === 'pending').length,
    toOrder: allReqs.filter(r => r.status === 'manager_approved').length,
    ordered: allReqs.filter(r => r.status === 'ordered').length,
    rejected: allReqs.filter(r => r.status === 'rejected').length,
  }

  const filterMap = {
    dashboard: null,
    toorder: 'manager_approved',
    all: null,
    pending: 'pending',
    ordered: 'ordered',
    rejected: 'rejected'
  }

  const displayReqs = filterMap[nav] ? allReqs.filter(r => r.status === filterMap[nav]) : allReqs

  const statusMap = { pending:'待審核', manager_approved:'待採購', ordered:'已訂購', rejected:'已退回' }
  const statusStyle = {
    pending: { bg:'#FEF3D7', color:'#633806' },
    manager_approved: { bg:'#E6F1FB', color:'#0C447C' },
    ordered: { bg:'#D9F2E6', color:'#1A4A2E' },
    rejected: { bg:'#FDEAEA', color:'#B83232' }
  }

  const navItems = [
    { id:'dashboard', icon:'📊', label:'統計儀表板' },
    { id:'toorder', icon:'📥', label:'待採購', badge: stats.toOrder },
    { id:'all', icon:'📋', label:'全部訂單' },
  ]

  return (
    <Layout profile={profile} onLogout={onLogout} navItems={navItems} activeNav={nav} onNav={setNav}>
      {toast && <div style={{ background:'#1A2F4A', color:'#fff', padding:'10px 16px', borderRadius:8, fontSize:13, marginBottom:16 }}>{toast}</div>}

      {/* DASHBOARD */}
      {nav === 'dashboard' && (
        <div>
          <h2 style={{ fontSize:18, fontWeight:700, marginBottom:16 }}>統計儀表板</h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:10, marginBottom:24 }}>
            {[
              { label:'全部', val: stats.all, color:'#1A2F4A' },
              { label:'待審核', val: stats.pending, color:'#854F0B' },
              { label:'待採購', val: stats.toOrder, color:'#185FA5' },
              { label:'已訂購', val: stats.ordered, color:'#1A7A4A' },
              { label:'退回', val: stats.rejected, color:'#B83232' },
            ].map(s => (
              <div key={s.label} style={{ background:'#fff', border:'1px solid #D8E4EC', borderRadius:10, padding:'14px 16px' }}>
                <div style={{ fontSize:11, color:'#6B7C8A', marginBottom:6 }}>{s.label}</div>
                <div style={{ fontSize:26, fontWeight:700, color: s.color }}>{s.val}</div>
              </div>
            ))}
          </div>
          <h3 style={{ fontSize:14, fontWeight:500, color:'#6B7C8A', marginBottom:12 }}>近期請購單</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {allReqs.slice(0, 5).map(req => {
              const s = statusStyle[req.status] || statusStyle.pending
              return (
                <div key={req.id} style={{ background:'#fff', border:'1px solid #D8E4EC', borderRadius:10, padding:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <span style={{ fontSize:13, fontWeight:500 }}>#{req.id.slice(0,8).toUpperCase()}</span>
                      <span style={{ fontSize:12, color:'#6B7C8A', marginLeft:10 }}>{req.store_name}　{req.submit_date}</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:13, fontWeight:500, color:'#185FA5' }}>NT$ {calcTotal(req).toLocaleString()}</span>
                      <span style={{ background:s.bg, color:s.color, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500 }}>{statusMap[req.status]}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ORDER LIST (toorder / all) */}
      {(nav === 'toorder' || nav === 'all') && (
        <div>
          <h2 style={{ fontSize:18, fontWeight:700, marginBottom:16 }}>
            {nav === 'toorder' ? `待採購訂單（${stats.toOrder} 件）` : `全部訂單（${stats.all} 件）`}
          </h2>
          {loading && <div style={{ color:'#6B7C8A', textAlign:'center', padding:'40px 0' }}>載入中...</div>}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {displayReqs.length === 0 && !loading && <div style={{ color:'#6B7C8A', textAlign:'center', padding:'40px 0' }}>目前沒有訂單</div>}
            {displayReqs.map(req => {
              const s = statusStyle[req.status] || statusStyle.pending
              const total = calcTotal(req)
              return (
                <div key={req.id} style={{ background:'#fff', border:'1px solid #D8E4EC', borderRadius:12, padding:16 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500 }}>#{req.id.slice(0,8).toUpperCase()}</div>
                      <div style={{ fontSize:12, color:'#6B7C8A', marginTop:2 }}>{req.store_name}　{req.submit_date}</div>
                    </div>
                    <span style={{ background:s.bg, color:s.color, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500 }}>{statusMap[req.status]}</span>
                  </div>

                  <div style={{ marginBottom:10 }}>
                    {req.requisition_items?.map(i => (
                      <div key={i.id} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'4px 0', borderBottom:'1px solid #EEF3F5' }}>
                        <span style={{ color:'#1A2F4A' }}>{i.products?.name} ×{i.quantity}　<span style={{ color:'#6B7C8A' }}>庫存：{i.stock_qty} {i.stock_unit}</span></span>
                        <span style={{ color:'#185FA5', fontWeight:500 }}>NT$ {((i.products?.price || 0) * i.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                    <div style={{ textAlign:'right', fontSize:13, fontWeight:700, color:'#185FA5', marginTop:8 }}>
                      訂單總計：NT$ {total.toLocaleString()}
                    </div>
                  </div>

                  {req.status === 'rejected' && req.reject_reason && (
                    <div style={{ background:'#FDEAEA', color:'#B83232', padding:'6px 10px', borderRadius:6, fontSize:12, marginBottom:10 }}>退回原因：{req.reject_reason}</div>
                  )}

                  {req.status === 'manager_approved' && (
                    <div>
                      <div style={{ display:'flex', gap:8 }}>
                        <button onClick={() => confirmOrder(req.id)}
                          style={{ background:'#185FA5', color:'#fff', border:'none', padding:'7px 16px', borderRadius:7, fontSize:12, cursor:'pointer' }}>
                          確認訂購
                        </button>
                        <button onClick={() => exportPDF(req)}
                          style={{ background:'#F5F8FA', color:'#1A2F4A', border:'1px solid #D8E4EC', padding:'7px 16px', borderRadius:7, fontSize:12, cursor:'pointer' }}>
                          輸出 PDF
                        </button>
                        <button onClick={() => { setRejectingId(rejectingId === req.id ? null : req.id); setRejectReason('') }}
                          style={{ background:'#fff', color:'#B83232', border:'1px solid #F09595', padding:'7px 16px', borderRadius:7, fontSize:12, cursor:'pointer' }}>
                          退回
                        </button>
                      </div>
                      {rejectingId === req.id && (
                        <div style={{ marginTop:10 }}>
                          <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                            placeholder="請填寫退回原因..." rows={2}
                            style={{ width:'100%', padding:'8px 10px', border:'1px solid #D8E4EC', borderRadius:7, fontSize:13, resize:'none' }} />
                          <div style={{ display:'flex', gap:8, marginTop:6 }}>
                            <button onClick={() => rejectOrder(req.id)}
                              style={{ background:'#B83232', color:'#fff', border:'none', padding:'6px 14px', borderRadius:7, fontSize:12, cursor:'pointer' }}>確認退回</button>
                            <button onClick={() => setRejectingId(null)}
                              style={{ background:'#F5F8FA', border:'1px solid #D8E4EC', padding:'6px 14px', borderRadius:7, fontSize:12, cursor:'pointer' }}>取消</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {req.status === 'ordered' && (
                    <button onClick={() => exportPDF(req)}
                      style={{ background:'#F5F8FA', color:'#1A2F4A', border:'1px solid #D8E4EC', padding:'7px 16px', borderRadius:7, fontSize:12, cursor:'pointer' }}>
                      重新輸出 PDF
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Layout>
  )
}
