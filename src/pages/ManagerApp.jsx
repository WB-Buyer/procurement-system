import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function ManagerApp({ profile, onLogout }) {
  const [nav, setNav] = useState('pending')
  const [reqs, setReqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => { fetchReqs() }, [nav])

  async function fetchReqs() {
    setLoading(true)
    let query = supabase
      .from('requisitions')
      .select('*, requisition_items(*, products(name, unit))')
      .order('created_at', { ascending: false })

    if (nav === 'pending') query = query.eq('status', 'pending')

    const { data } = await query
    setReqs(data || [])
    setLoading(false)
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  async function approve(id) {
    await supabase.from('requisitions').update({ status: 'manager_approved' }).eq('id', id)
    showToast('已核准，轉送採購確認')
    fetchReqs()
  }

  async function reject(id) {
    if (!rejectReason.trim()) { alert('請填寫退回原因'); return }
    await supabase.from('requisitions').update({ status: 'rejected', reject_reason: rejectReason }).eq('id', id)
    setRejectingId(null)
    setRejectReason('')
    showToast('已退回，員工將收到通知')
    fetchReqs()
  }

  const statusMap = { pending:'待審核', manager_approved:'已核准', ordered:'已訂購', rejected:'已退回' }
  const statusStyle = {
    pending: { bg:'#FEF3D7', color:'#633806' },
    manager_approved: { bg:'#E6F1FB', color:'#0C447C' },
    ordered: { bg:'#D9F2E6', color:'#1A4A2E' },
    rejected: { bg:'#FDEAEA', color:'#B83232' }
  }

  const pendingCount = reqs.filter(r => r.status === 'pending').length

  const navItems = [
    { id:'pending', icon:'📥', label:'待審核', badge: nav === 'pending' ? 0 : pendingCount },
    { id:'history', icon:'📋', label:'歷史紀錄' },
  ]

  return (
    <Layout profile={profile} onLogout={onLogout} navItems={navItems} activeNav={nav} onNav={setNav}>
      {toast && <div style={{ background:'#1A2F4A', color:'#fff', padding:'10px 16px', borderRadius:8, fontSize:13, marginBottom:16 }}>{toast}</div>}

      <h2 style={{ fontSize:18, fontWeight:700, marginBottom:16 }}>
        {nav === 'pending' ? `待審核請購單（${reqs.length} 件）` : '歷史請購紀錄'}
      </h2>

      {loading && <div style={{ color:'#6B7C8A', textAlign:'center', padding:'40px 0' }}>載入中...</div>}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {!loading && reqs.length === 0 && <div style={{ color:'#6B7C8A', textAlign:'center', padding:'40px 0' }}>目前沒有請購單</div>}
        {reqs.map(req => {
          const s = statusStyle[req.status] || statusStyle.pending
          return (
            <div key={req.id} style={{ background:'#fff', border:'1px solid #D8E4EC', borderRadius:12, padding:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:500 }}>#{req.id.slice(0,8).toUpperCase()}</div>
                  <div style={{ fontSize:12, color:'#6B7C8A', marginTop:2 }}>{req.store_name}　{req.submit_date}</div>
                </div>
                <span style={{ background:s.bg, color:s.color, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500 }}>
                  {statusMap[req.status]}
                </span>
              </div>

              <div style={{ fontSize:12, color:'#6B7C8A', marginBottom:10, lineHeight:1.7 }}>
                {req.requisition_items?.map(i => (
                  <span key={i.id} style={{ display:'inline-block', background:'#F5F8FA', border:'1px solid #D8E4EC', padding:'2px 8px', borderRadius:20, marginRight:6, marginBottom:4 }}>
                    {i.products?.name} ×{i.quantity}（庫存：{i.stock_qty} {i.stock_unit}）
                  </span>
                ))}
              </div>

              {req.note && <div style={{ fontSize:12, color:'#6B7C8A', marginBottom:10 }}>備註：{req.note}</div>}

              {req.status === 'rejected' && req.reject_reason && (
                <div style={{ background:'#FDEAEA', color:'#B83232', padding:'6px 10px', borderRadius:6, fontSize:12, marginBottom:10 }}>退回原因：{req.reject_reason}</div>
              )}

              {nav === 'pending' && req.status === 'pending' && (
                <div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => approve(req.id)}
                      style={{ background:'#1D9E75', color:'#fff', border:'none', padding:'7px 16px', borderRadius:7, fontSize:12, cursor:'pointer' }}>
                      核准
                    </button>
                    <button onClick={() => { setRejectingId(rejectingId === req.id ? null : req.id); setRejectReason('') }}
                      style={{ background:'#fff', color:'#B83232', border:'1px solid #F09595', padding:'7px 16px', borderRadius:7, fontSize:12, cursor:'pointer' }}>
                      退回
                    </button>
                  </div>
                  {rejectingId === req.id && (
                    <div style={{ marginTop:10 }}>
                      <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                        placeholder="請填寫退回原因（必填）..." rows={2}
                        style={{ width:'100%', padding:'8px 10px', border:'1px solid #D8E4EC', borderRadius:7, fontSize:13, resize:'none' }} />
                      <div style={{ display:'flex', gap:8, marginTop:6 }}>
                        <button onClick={() => reject(req.id)}
                          style={{ background:'#B83232', color:'#fff', border:'none', padding:'6px 14px', borderRadius:7, fontSize:12, cursor:'pointer' }}>
                          確認退回
                        </button>
                        <button onClick={() => setRejectingId(null)}
                          style={{ background:'#F5F8FA', border:'1px solid #D8E4EC', padding:'6px 14px', borderRadius:7, fontSize:12, cursor:'pointer' }}>
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Layout>
  )
}
