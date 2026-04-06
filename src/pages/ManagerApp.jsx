import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const C = {
  primary: '#C4B1A0', primaryDark: '#A59482', primaryLight: '#EDE5DC',
  border: '#D9CEC5', text: '#3D3530', textMuted: '#A59482', white: '#FFFFFF',
  red: '#B83232', redLight: '#FDEAEA', green: '#1A7A4A', greenLight: '#D9F2E6',
}

function generateOrderId(createdAt, seq) {
  const d = new Date(createdAt)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `#${y}${m}${day}-${String(seq).padStart(2, '0')}`
}

const NOTIFY_EMAIL = 'wb25236700@gmail.com'

async function sendNotification(subject, body) {
  try {
    await supabase.functions.invoke('send-email', {
      body: { to: NOTIFY_EMAIL, subject, body }
    })
  } catch (e) {
    console.log('Email notification skipped:', e.message)
  }
}

export default function ManagerApp({ profile, onLogout }) {
  const [nav, setNav] = useState('pending')
  const [reqs, setReqs] = useState([])
  const [allReqs, setAllReqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => { fetchReqs() }, [nav])

  async function fetchReqs() {
    setLoading(true)
    const { data: all } = await supabase
      .from('requisitions')
      .select('*, requisition_items(*, products(name, unit))')
      .order('created_at', { ascending: false })
    setAllReqs(all || [])
    setReqs(nav === 'pending' ? (all || []).filter(r => r.status === 'pending') : (all || []))
    setLoading(false)
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  async function approve(id, req, idx) {
    const now = new Date().toISOString()
    await supabase.from('requisitions').update({ status: 'manager_approved', approved_at: now }).eq('id', id)

    const orderId = generateOrderId(req.created_at, idx + 1)
    await sendNotification(
      `【晶緻集團請購系統】請購單已核准，待採購確認`,
      `店長已核准請購單 ${orderId}（${req.store_name}），共 ${req.requisition_items?.length || 0} 項品項，請採購人員確認訂購。`
    )

    showToast('已核准，轉送採購確認')
    fetchReqs()
  }

  async function reject(id) {
    if (!rejectReason.trim()) { alert('請填寫退回原因'); return }
    await supabase.from('requisitions').update({ status: 'rejected', reject_reason: rejectReason }).eq('id', id)
    setRejectingId(null); setRejectReason('')
    showToast('已退回，員工將收到通知')
    fetchReqs()
  }

  const statusMap = { pending:'待審核', manager_approved:'已核准', ordered:'已訂購', rejected:'已退回' }
  const statusStyle = {
    pending: { bg:'#FEF3D7', color:'#633806' },
    manager_approved: { bg:C.primaryLight, color:C.primaryDark },
    ordered: { bg:C.greenLight, color:C.green },
    rejected: { bg:C.redLight, color:C.red }
  }

  const navItems = [
    { id:'pending', icon:'📥', label:'待審核', badge: allReqs.filter(r => r.status === 'pending').length },
    { id:'history', icon:'📋', label:'歷史紀錄' },
  ]

  const ReqCard = ({ req, idx, showActions }) => {
    const s = statusStyle[req.status] || statusStyle.pending
    const orderId = generateOrderId(req.created_at, idx + 1)
    return (
      <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12, padding:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:500, color:C.text }}>成立編號：{orderId}</div>
            <div style={{ fontSize:12, color:C.textMuted, marginTop:4 }}>門市：{req.store_name}　{req.submit_date}</div>
          </div>
          <span style={{ background:s.bg, color:s.color, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500 }}>
            {statusMap[req.status]}
          </span>
        </div>

        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:12, color:C.textMuted, marginBottom:4 }}>品項：</div>
          {req.requisition_items?.map((i, ii) => (
            <div key={ii} style={{ fontSize:12, color:C.text, padding:'4px 0 4px 12px', borderLeft:`2px solid ${C.border}`, marginBottom:3, display:'flex', justifyContent:'space-between' }}>
              <span>{i.products?.name}</span>
              <span style={{ color:C.textMuted }}>×{i.quantity} {i.products?.unit}</span>
            </div>
          ))}
        </div>

        {req.note && <div style={{ fontSize:12, color:C.textMuted, marginBottom:10 }}>備註：{req.note}</div>}
        {req.status === 'rejected' && req.reject_reason && (
          <div style={{ background:C.redLight, color:C.red, padding:'6px 10px', borderRadius:6, fontSize:12, marginBottom:10 }}>退回原因：{req.reject_reason}</div>
        )}

        {showActions && req.status === 'pending' && (
          <div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => approve(req.id, req, idx)}
                style={{ background:C.green, color:C.white, border:'none', padding:'7px 16px', borderRadius:7, fontSize:12, cursor:'pointer' }}>
                核准
              </button>
              <button onClick={() => { setRejectingId(rejectingId === req.id ? null : req.id); setRejectReason('') }}
                style={{ background:C.white, color:C.red, border:'1px solid #F09595', padding:'7px 16px', borderRadius:7, fontSize:12, cursor:'pointer' }}>
                退回
              </button>
            </div>
            {rejectingId === req.id && (
              <div style={{ marginTop:10 }}>
                <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                  placeholder="請填寫退回原因（必填）..." rows={2}
                  style={{ width:'100%', padding:'8px 10px', border:`1px solid ${C.border}`, borderRadius:7, fontSize:13, resize:'none', color:C.text }} />
                <div style={{ display:'flex', gap:8, marginTop:6 }}>
                  <button onClick={() => reject(req.id)}
                    style={{ background:C.red, color:C.white, border:'none', padding:'6px 14px', borderRadius:7, fontSize:12, cursor:'pointer' }}>確認退回</button>
                  <button onClick={() => setRejectingId(null)}
                    style={{ background:C.primaryLight, border:`1px solid ${C.border}`, padding:'6px 14px', borderRadius:7, fontSize:12, cursor:'pointer', color:C.text }}>取消</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <Layout profile={profile} onLogout={onLogout} navItems={navItems} activeNav={nav} onNav={setNav}>
      {toast && <div style={{ background:C.text, color:'#fff', padding:'10px 16px', borderRadius:8, fontSize:13, marginBottom:16 }}>{toast}</div>}
      <h2 style={{ fontSize:18, fontWeight:700, marginBottom:16, color:C.text }}>
        {nav === 'pending' ? `待審核請購單（${reqs.length} 件）` : '歷史請購紀錄'}
      </h2>
      {loading && <div style={{ color:C.textMuted, textAlign:'center', padding:'40px 0' }}>載入中...</div>}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {!loading && reqs.length === 0 && <div style={{ color:C.textMuted, textAlign:'center', padding:'40px 0' }}>目前沒有請購單</div>}
        {reqs.map((req, idx) => <ReqCard key={req.id} req={req} idx={idx} showActions={nav === 'pending'} />)}
      </div>
    </Layout>
  )
}
