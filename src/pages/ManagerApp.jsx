import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const C = {
  primary: '#C4B1A0', primaryDark: '#A59482', primaryLight: '#EDE5DC',
  border: '#D9CEC5', text: '#3D3530', textMuted: '#A59482', white: '#FFFFFF',
  red: '#B83232', redLight: '#FDEAEA', green: '#1A7A4A', greenLight: '#D9F2E6',
  blue: '#185FA5',
}

function generateOrderId(createdAt, seq) {
  const d = new Date(createdAt)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `#${y}${m}${day}-${String(seq).padStart(2, '0')}`
}

export default function ManagerApp({ profile, onLogout }) {
  const [nav, setNav] = useState('pending')
  const [reqs, setReqs] = useState([])
  const [allReqs, setAllReqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [toast, setToast] = useState('')
  const [owners, setOwners] = useState({})
  const [filterProduct, setFilterProduct] = useState('')
  const [filterDate, setFilterDate] = useState('')

  useEffect(() => { fetchReqs(); fetchOwners() }, [nav])

  async function fetchOwners() {
    const { data } = await supabase.from('product_owners').select('store_name, product_id, owner_name')
    const map = {}
    ;(data || []).forEach(o => { map[`${o.store_name}__${o.product_id}`] = o.owner_name })
    setOwners(map)
  }

  async function fetchReqs() {
    setLoading(true)
    const { data: all } = await supabase
      .from('requisitions')
      .select('*, requisition_items(*, products(name, unit, price, spec))')
      .order('created_at', { ascending: false })
    setAllReqs(all || [])
    setReqs(nav === 'pending' ? (all || []).filter(r => r.status === 'pending') : (all || []))
    setLoading(false)
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  async function approve(id, req, idx) {
    const now = new Date().toISOString()
    await supabase.from('requisitions').update({ status: 'manager_approved', approved_at: now }).eq('id', id)
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

  function calcTotal(req) {
    return req.requisition_items?.reduce((sum, i) => sum + (i.products?.price || 0) * i.quantity, 0) || 0
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

  const [expandedIds, setExpandedIds] = useState({})
  function toggleExpand(id) { setExpandedIds(prev => ({ ...prev, [id]: !prev[id] })) }

  const ReqCard = ({ req, idx, showActions }) => {
    const s = statusStyle[req.status] || statusStyle.pending
    const orderId = generateOrderId(req.created_at, idx + 1)
    const total = calcTotal(req)
    const items = req.requisition_items || []
    const LIMIT = 5
    const isExpanded = expandedIds[req.id]
    const visibleItems = isExpanded ? items : items.slice(0, LIMIT)
    const hasMore = items.length > LIMIT

    return (
      <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12, padding:16 }}>

        {/* 標題列 */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:500, color:C.text }}>成立編號：{orderId}</div>
            <div style={{ fontSize:12, color:C.textMuted, marginTop:4 }}>
              門市：{req.store_name}　送單日期：{req.submit_date}
            </div>
          </div>
          <span style={{ background:s.bg, color:s.color, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500 }}>
            {statusMap[req.status]}
          </span>
        </div>

        {/* 品項表格 header */}
        <div style={{ fontSize:12, color:C.textMuted, marginBottom:6 }}>品項：</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 100px 90px 110px 90px 90px 80px', gap:8, padding:'5px 10px', background:C.primaryLight, borderRadius:6, marginBottom:4, fontSize:11, color:C.primaryDark, fontWeight:500 }}>
          <span>品項名稱</span>
          <span>規格</span>
          <span style={{ textAlign:'center' }}>請購數量</span>
          <span style={{ textAlign:'center' }}>庫存數量</span>
          <span style={{ textAlign:'right' }}>金額</span>
          <span style={{ textAlign:'right' }}>備註</span>
          <span style={{ textAlign:'center' }}>負責人</span>
        </div>

        {/* 品項列表 */}
        {visibleItems.map((i, ii) => {
          const owner = owners[`${req.store_name}__${i.product_id}`]
          const ownerColors = [
            { bg:'#E6F1FB', dot:'#185FA5', text:'#0C447C' },
            { bg:'#D9F2E6', dot:'#1A7A4A', text:'#1A4A2E' },
            { bg:'#EDE5DC', dot:'#A59482', text:'#3D3530' },
            { bg:'#FEF3D7', dot:'#BA7517', text:'#633806' },
          ]
          const oc = owner ? ownerColors[owner.charCodeAt(0) % ownerColors.length] : null
          return (
          <div key={ii} style={{ display:'grid', gridTemplateColumns:'1fr 100px 90px 110px 90px 90px 80px', gap:8, padding:'6px 10px', borderLeft:`2px solid ${C.border}`, marginBottom:3, alignItems:'center' }}>
            <span style={{ fontSize:12, color:C.text }}>{i.products?.name}</span>
            <span style={{ fontSize:11, color:C.textMuted }}>{i.products?.spec || '-'}</span>
            <span style={{ fontSize:12, color:C.text, textAlign:'center' }}>×{i.quantity} {i.products?.unit}</span>
            <span style={{ fontSize:12, color:C.textMuted, textAlign:'center' }}>{i.stock_qty} {i.stock_unit}</span>
            <span style={{ fontSize:12, color:C.blue, fontWeight:500, textAlign:'right' }}>NT$ {((i.products?.price || 0) * i.quantity).toLocaleString()}</span>
            <span style={{ fontSize:11, color:C.textMuted, textAlign:'right', wordBreak:'break-all' }}>{i.item_note || '-'}</span>
            <div style={{ display:'flex', justifyContent:'center' }}>
              {owner && oc
                ? <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:oc.bg, color:oc.text, padding:'2px 7px', borderRadius:20, fontSize:10, fontWeight:500 }}>
                    <span style={{ width:5, height:5, borderRadius:'50%', background:oc.dot, display:'inline-block' }}></span>{owner}
                  </span>
                : <span style={{ fontSize:11, color:C.textMuted }}>-</span>
              }
            </div>
          </div>
        })}
        {hasMore && (
          <button onClick={() => toggleExpand(req.id)}
            style={{ background:'transparent', border:`1px solid ${C.border}`, color:C.primaryDark, padding:'4px 12px', borderRadius:20, fontSize:11, cursor:'pointer', marginTop:4 }}>
            {isExpanded ? '▲ 收合' : `▼ 展開全部 ${items.length} 項`}
          </button>
        )}

        {/* 總金額 */}
        <div style={{ textAlign:'right', fontSize:13, fontWeight:500, color:C.blue, marginTop:10, paddingTop:8, borderTop:`1px solid ${C.border}` }}>
          總金額：NT$ {total.toLocaleString()}
        </div>

        {/* 整單備註 */}
        {req.note && (
          <div style={{ marginTop:8, fontSize:12, color:C.textMuted, background:C.primaryLight, padding:'6px 10px', borderRadius:6 }}>
            整單備註：{req.note}
          </div>
        )}

        {/* 退回原因 */}
        {req.status === 'rejected' && req.reject_reason && (
          <div style={{ background:C.redLight, color:C.red, padding:'6px 10px', borderRadius:6, fontSize:12, marginTop:8 }}>
            退回原因：{req.reject_reason}
          </div>
        )}

        {/* 操作按鈕 */}
        {showActions && req.status === 'pending' && (
          <div style={{ marginTop:12 }}>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => approve(req.id, req, idx)}
                style={{ background:C.green, color:C.white, border:'none', padding:'7px 20px', borderRadius:7, fontSize:12, cursor:'pointer', fontWeight:500 }}>
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
                    style={{ background:C.red, color:C.white, border:'none', padding:'6px 14px', borderRadius:7, fontSize:12, cursor:'pointer' }}>
                    確認退回
                  </button>
                  <button onClick={() => setRejectingId(null)}
                    style={{ background:C.primaryLight, border:`1px solid ${C.border}`, padding:'6px 14px', borderRadius:7, fontSize:12, cursor:'pointer', color:C.text }}>
                    取消
                  </button>
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
      {toast && (
        <div style={{ background:C.text, color:'#fff', padding:'10px 16px', borderRadius:8, fontSize:13, marginBottom:16 }}>
          {toast}
        </div>
      )}

      <h2 style={{ fontSize:18, fontWeight:700, marginBottom:12, color:C.text }}>
        {nav === 'pending' ? `待審核請購單（${reqs.length} 件）` : '歷史請購紀錄'}
      </h2>

      {/* 篩選列 */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <input value={filterProduct} onChange={e => setFilterProduct(e.target.value)}
          placeholder="🔍 搜尋品項名稱..."
          style={{ padding:'7px 12px', border:`1px solid ${C.border}`, borderRadius:7, fontSize:12, color:C.text, width:200 }} />
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          style={{ padding:'7px 12px', border:`1px solid ${C.border}`, borderRadius:7, fontSize:12, color:C.text }} />
        {(filterProduct || filterDate) && (
          <button onClick={() => { setFilterProduct(''); setFilterDate('') }}
            style={{ padding:'7px 12px', border:`1px solid ${C.border}`, borderRadius:7, fontSize:12, color:C.red, background:C.redLight, cursor:'pointer' }}>
            清除篩選
          </button>
        )}
      </div>

      {loading && <div style={{ color:C.textMuted, textAlign:'center', padding:'40px 0' }}>載入中...</div>}

      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {!loading && (() => {
          const filtered = reqs.filter(req => {
            const matchProduct = !filterProduct || req.requisition_items?.some(i =>
              i.products?.name?.toLowerCase().includes(filterProduct.toLowerCase()))
            const matchDate = !filterDate || req.submit_date === filterDate
            return matchProduct && matchDate
          })
          if (filtered.length === 0) return <div style={{ color:C.textMuted, textAlign:'center', padding:'40px 0' }}>目前沒有符合條件的請購單</div>
          return filtered.map((req, idx) => <ReqCard key={req.id} req={req} idx={idx} showActions={nav === 'pending'} />)
        })()}
      </div>
    </Layout>
  )
}
