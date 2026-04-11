import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const CATEGORIES = ['全部', '保養品', '美容耗材', '微整針劑', '藥品', '醫療耗材', '手術耗材', '手術器械']
const UNITS = ['支', '瓶', '盒', '個', '片', '卷', '件', '顆', '包']

const C = {
  primary: '#C4B1A0', primaryDark: '#A59482', primaryLight: '#EDE5DC',
  border: '#D9CEC5', text: '#3D3530', textMuted: '#A59482', white: '#FFFFFF',
  red: '#B83232', redLight: '#FDEAEA',
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
      body: { subject, body }
    })
  } catch (e) {
    console.log('LINE notification skipped:', e.message)
  }
}

export default function StaffApp({ profile, onLogout }) {
  const [nav, setNav] = useState('catalog')
  const [products, setProducts] = useState([])
  const CART_KEY = `cart_${profile?.id}`
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem(`cart_${profile?.id}`)
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [myReqs, setMyReqs] = useState([])
  const [activeCat, setActiveCat] = useState('全部')
  const [search, setSearch] = useState('')
  const [modalProduct, setModalProduct] = useState(null)
  const [stockQty, setStockQty] = useState('')
  const [stockUnit, setStockUnit] = useState('')
  const [itemNote, setItemNote] = useState('')
  const [reqCount, setReqCount] = useState('')
  const [submitDate, setSubmitDate] = useState(new Date().toISOString().split('T')[0])
  const [submitNote, setSubmitNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState('')
  const [owners, setOwners] = useState({})

  useEffect(() => { fetchProducts(); fetchOwners() }, [])
  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)) } catch {}
  }, [cart])
  useEffect(() => { if (nav === 'myreqs') fetchMyReqs() }, [nav])

  async function fetchOwners() {
    const { data } = await supabase.from('product_owners').select('store_name, product_id, owner_name')
    const map = {}
    ;(data || []).forEach(o => { map[`${o.store_name}__${o.product_id}`] = o.owner_name })
    setOwners(map)
  }

  async function fetchProducts() {
    const { data } = await supabase.from('products').select('*').eq('active', true).order('category')
    setProducts(data || [])
  }

  async function fetchMyReqs() {
    const { data } = await supabase
      .from('requisitions').select('*, requisition_items(*, products(name, unit))')
      .eq('requester_id', profile.id).order('created_at', { ascending: false })
    setMyReqs(data || [])
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  function openModal(product) {
    setModalProduct(product)
    setStockQty(''); setStockUnit(''); setItemNote(''); setReqCount('')
  }

  function confirmAddToCart() {
    if (!reqCount || !stockQty) { alert('請選擇請購數量與庫存數量（必填）'); return }
    setCart(prev => [...prev, { ...modalProduct, reqQty: parseInt(reqCount), stockInfo: `${stockQty} ${modalProduct.stock_unit || modalProduct.unit}`, itemNote }])
    setModalProduct(null)
    showToast(`已加入購物車：${modalProduct.name}`)
  }

  function changeQty(idx, delta) {
    setCart(prev => prev.map((item, i) => i === idx ? { ...item, reqQty: Math.max(1, item.reqQty + delta) } : item))
  }

  function removeFromCart(idx) { setCart(prev => prev.filter((_, i) => i !== idx)) }

  async function submitRequisition() {
    if (cart.length === 0) return
    setSubmitting(true)
    const { data: req, error } = await supabase.from('requisitions').insert({
      requester_id: profile.id,
      store_name: profile.store_name,
      status: 'pending',
      note: submitNote,
      submit_date: submitDate
    }).select().single()
    if (error) { alert('送出失敗，請重試'); setSubmitting(false); return }
    const items = cart.map(item => ({
      requisition_id: req.id,
      product_id: item.id,
      quantity: item.reqQty,
      stock_qty: parseInt(item.stockInfo) || 0,
      stock_unit: item.stockInfo.split(' ')[1] || '',
      item_note: item.itemNote || ''
    }))
    await supabase.from('requisition_items').insert(items)

    const orderId = generateOrderId(req.created_at, 1)
    await sendNotification(
      `【晶緻集團請購系統】新請購單`,
      `📋 新請購單待審核
門市：${profile.store_name}
單號：${orderId}
請店長盡快審核。`
    )

    setCart([]); setSubmitNote(''); setSubmitting(false)
    try { localStorage.removeItem(CART_KEY) } catch {}
    showToast('請購單已送出！等待店長審核')
    setNav('myreqs')
  }

  const filtered = products.filter(p =>
    (activeCat === '全部' || p.category === activeCat) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const statusMap = { pending:'待審核', manager_approved:'待採購', ordered:'已訂購', rejected:'已退回' }
  const statusStyle = {
    pending: { bg:'#FEF3D7', color:'#633806' },
    manager_approved: { bg:C.primaryLight, color:C.primaryDark },
    ordered: { bg:'#D9F2E6', color:'#1A4A2E' },
    rejected: { bg:C.redLight, color:C.red }
  }

  const navItems = [
    { id:'catalog', icon:'🗂', label:'商品目錄' },
    { id:'cart', icon:'🛒', label:'購物車', badge: cart.length },
    { id:'myreqs', icon:'📋', label:'我的請購' },
  ]

  return (
    <Layout profile={profile} onLogout={onLogout} navItems={navItems} activeNav={nav} onNav={setNav}>
      {toast && <div style={{ background:C.text, color:'#fff', padding:'10px 16px', borderRadius:8, fontSize:13, marginBottom:16 }}>{toast}</div>}

      {/* CATALOG */}
      {nav === 'catalog' && (
        <div>
          <h2 style={{ fontSize:18, fontWeight:700, marginBottom:16, color:C.text }}>商品目錄</h2>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋品項名稱..."
            style={{ width:'100%', padding:'9px 14px', border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, marginBottom:14, background:C.white, color:C.text }} />
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setActiveCat(cat)}
                style={{ padding:'5px 14px', borderRadius:20, border:'1px solid', fontSize:12, cursor:'pointer',
                  background: activeCat === cat ? C.primary : C.white,
                  color: activeCat === cat ? C.white : C.textMuted,
                  borderColor: activeCat === cat ? C.primary : C.border }}>
                {cat}
              </button>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(210px, 1fr))', gap:12 }}>
            {filtered.map(p => (
              <div key={p.id} style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden' }}>
                {p.image_url
                  ? <img src={p.image_url} alt={p.name} style={{ width:'100%', height:130, objectFit:'cover' }} />
                  : <div style={{ width:'100%', height:130, background:C.primaryLight, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <span style={{ fontSize:32 }}>🖼</span>
                    </div>
                }
                <div style={{ padding:'12px 14px' }}>
                  <span style={{ background:C.primaryLight, color:C.primaryDark, fontSize:10, fontWeight:500, padding:'2px 8px', borderRadius:20, display:'inline-block', marginBottom:8 }}>{p.category}</span>
                  <div style={{ fontSize:13, fontWeight:500, marginBottom:6, lineHeight:1.4, color:C.text }}>{p.name}</div>

                  {/* 四行補充資訊 */}
                  <div style={{ fontSize:11, color:C.textMuted, marginBottom:2 }}>廠牌：{p.brand || '-'}</div>
                  <div style={{ fontSize:11, color:C.textMuted, marginBottom:2 }}>規格：{p.spec || '-'}</div>
                  <div style={{ fontSize:11, color:C.textMuted, marginBottom:2 }}>效期：{p.expiry_info || '-'}</div>
                  <div style={{ fontSize:11, color:C.textMuted, marginBottom:10 }}>補充說明：{p.extra_note || '-'}</div>

                  <div style={{ fontSize:11, color:C.primaryDark, marginBottom:10 }}>請購單位：{p.unit}</div>
                  <button onClick={() => openModal(p)}
                    style={{ width:'100%', background:C.primary, color:C.white, border:'none', padding:'7px', borderRadius:7, fontSize:12, cursor:'pointer' }}>
                    加入購物車
                  </button>
                </div>
              </div>
            ))}
          </div>
          {filtered.length === 0 && <div style={{ textAlign:'center', color:C.textMuted, padding:'40px 0' }}>找不到符合的品項</div>}
        </div>
      )}

      {/* MODAL */}
      {modalProduct && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }} onClick={e => e.stopPropagation()}>
          <div style={{ background:C.white, borderRadius:14, padding:24, width:380, maxWidth:'90vw' }}>
            <h3 style={{ fontSize:15, fontWeight:700, marginBottom:4, color:C.text }}>加入購物車</h3>
            <p style={{ fontSize:12, color:C.textMuted, marginBottom:18 }}>{modalProduct.name}</p>

            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, color:C.textMuted, display:'block', marginBottom:6 }}>
                請購數量 <span style={{ color:C.red }}>★ 必填</span>
              </label>
              <div style={{ display:'flex', gap:8 }}>
                <select value={reqCount} onChange={e => setReqCount(e.target.value)}
                  style={{ flex:1, padding:'8px 10px', border:`1px solid ${C.border}`, borderRadius:7, fontSize:13, color:C.text }}>
                  <option value="">數量</option>
                  {Array.from({length:100}, (_, i) => i + 1).map(n => <option key={n}>{n}</option>)}
                </select>
                <div style={{ padding:'8px 12px', background:C.primaryLight, borderRadius:7, fontSize:13, color:C.primaryDark, display:'flex', alignItems:'center' }}>
                  {modalProduct.unit}
                </div>
              </div>
            </div>

            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, color:C.textMuted, display:'block', marginBottom:6 }}>
                目前庫存數量 <span style={{ color:C.red }}>★ 必填</span>
              </label>
              <div style={{ display:'flex', gap:8 }}>
                <select value={stockQty} onChange={e => setStockQty(e.target.value)}
                  style={{ flex:1, padding:'8px 10px', border:`1px solid ${C.border}`, borderRadius:7, fontSize:13, color:C.text }}>
                  <option value="">選擇數量</option>
                  {Array.from({length:500}, (_, i) => i + 1).map(n => <option key={n}>{n}</option>)}
                </select>
                <div style={{ padding:'8px 12px', background:C.primaryLight, borderRadius:7, fontSize:13, color:C.primaryDark, display:'flex', alignItems:'center', flexShrink:0 }}>
                  {modalProduct.stock_unit || modalProduct.unit}
                </div>
              </div>
            </div>

            <div style={{ marginBottom:18 }}>
              <label style={{ fontSize:12, color:C.textMuted, display:'block', marginBottom:6 }}>備註 / 請購原因</label>
              <textarea value={itemNote} onChange={e => setItemNote(e.target.value)}
                placeholder="可自由填寫，不限字數..." rows={3}
                style={{ width:'100%', padding:'8px 10px', border:`1px solid ${C.border}`, borderRadius:7, fontSize:13, resize:'vertical', color:C.text }} />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setModalProduct(null)}
                style={{ flex:1, padding:'9px', border:`1px solid ${C.border}`, borderRadius:8, background:C.primaryLight, fontSize:13, cursor:'pointer', color:C.text }}>
                取消
              </button>
              <button onClick={confirmAddToCart}
                style={{ flex:1, padding:'9px', background:C.primary, color:C.white, border:'none', borderRadius:8, fontSize:13, cursor:'pointer', fontWeight:500 }}>
                確認加入
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CART */}
      {nav === 'cart' && (
        <div>
          <h2 style={{ fontSize:18, fontWeight:700, marginBottom:16, color:C.text }}>購物車</h2>
          {cart.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 0', color:C.textMuted }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🛒</div>
              <p style={{ marginBottom:16 }}>購物車是空的</p>
              <button onClick={() => setNav('catalog')}
                style={{ background:C.primary, color:C.white, border:'none', padding:'9px 20px', borderRadius:8, fontSize:13, cursor:'pointer' }}>
                前往商品目錄
              </button>
            </div>
          ) : (
            <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
              {cart.map((item, idx) => (
                <div key={idx} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom:`1px solid ${C.border}` }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:500, color:C.text }}>{item.name}</div>
                    <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>
                      請購單位：{item.unit}　庫存：{item.stockInfo}
                      {item.itemNote ? `　備註：${item.itemNote}` : ''}
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <button onClick={() => changeQty(idx, -1)} style={{ width:28, height:28, border:`1px solid ${C.border}`, borderRadius:6, background:C.primaryLight, cursor:'pointer', fontSize:14, color:C.text }}>-</button>
                    <span style={{ fontSize:13, minWidth:24, textAlign:'center', color:C.text }}>{item.reqQty}</span>
                    <button onClick={() => changeQty(idx, 1)} style={{ width:28, height:28, border:`1px solid ${C.border}`, borderRadius:6, background:C.primaryLight, cursor:'pointer', fontSize:14, color:C.text }}>+</button>
                    <button onClick={() => removeFromCart(idx)} style={{ width:28, height:28, border:'1px solid #F09595', borderRadius:6, background:C.redLight, cursor:'pointer', color:C.red, fontSize:14 }}>×</button>
                  </div>
                </div>
              ))}
              <div style={{ marginTop:20, display:'flex', flexDirection:'column', gap:12 }}>
                <div>
                  <label style={{ fontSize:12, color:C.textMuted, display:'block', marginBottom:6 }}>送單日期</label>
                  <input type="date" value={submitDate} onChange={e => setSubmitDate(e.target.value)}
                    style={{ padding:'8px 12px', border:`1px solid ${C.border}`, borderRadius:7, fontSize:13, color:C.text }} />
                </div>
                <div>
                  <label style={{ fontSize:12, color:C.textMuted, display:'block', marginBottom:6 }}>整單備註（選填）</label>
                  <input value={submitNote} onChange={e => setSubmitNote(e.target.value)} placeholder="如：急件優先處理"
                    style={{ width:'100%', padding:'8px 12px', border:`1px solid ${C.border}`, borderRadius:7, fontSize:13, color:C.text }} />
                </div>
                <button onClick={submitRequisition} disabled={submitting}
                  style={{ padding:'11px', background:C.primary, color:C.white, border:'none', borderRadius:8, fontSize:14, fontWeight:500, cursor:'pointer', marginTop:4 }}>
                  {submitting ? '送出中...' : '送出請購單'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MY REQUESTS */}
      {nav === 'myreqs' && (
        <div>
          <h2 style={{ fontSize:18, fontWeight:700, marginBottom:16, color:C.text }}>我的請購</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {myReqs.length === 0 && <div style={{ color:C.textMuted, textAlign:'center', padding:'40px 0' }}>尚無請購紀錄</div>}
            {myReqs.map((req, idx) => {
              const s = statusStyle[req.status] || statusStyle.pending
              const label = statusMap[req.status] || req.status
              const orderId = generateOrderId(req.created_at, idx + 1)
              return (
                <div key={req.id} style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12, padding:16 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500, color:C.text }}>成立編號：{orderId}</div>
                      <div style={{ fontSize:12, color:C.textMuted, marginTop:4 }}>門市：{req.store_name || '-'}</div>
                    </div>
                    <span style={{ background:s.bg, color:s.color, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, whiteSpace:'nowrap' }}>{label}</span>
                  </div>
                  <div style={{ marginBottom: req.status === 'rejected' ? 10 : 0 }}>
                    <div style={{ fontSize:12, color:C.textMuted, marginBottom:4 }}>品項：</div>
                    {req.requisition_items?.map((i, ii) => {
                      const owner = owners[`${req.store_name}__${i.product_id}`]
                      return (
                        <div key={ii} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12, color:C.text, padding:'4px 0 4px 12px', borderLeft:`2px solid ${C.border}`, marginBottom:3 }}>
                          <span>{i.products?.name} ×{i.quantity} {i.products?.unit}</span>
                          {owner && (
                            <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:C.primaryLight, color:C.primaryDark, padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:500, flexShrink:0, marginLeft:8 }}>
                              <span style={{ width:5, height:5, borderRadius:'50%', background:C.primaryDark, display:'inline-block' }}></span>
                              {owner}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {req.status === 'rejected' && req.reject_reason && (
                    <div style={{ background:C.redLight, color:C.red, padding:'6px 10px', borderRadius:6, fontSize:12, marginBottom:10 }}>
                      退回原因：{req.reject_reason}
                    </div>
                  )}
                  {req.status === 'rejected' && (
                    <button onClick={() => {
                      const items = req.requisition_items?.map(i => ({
                        id: i.product_id, name: i.products?.name, unit: i.products?.unit,
                        reqQty: i.quantity, stockInfo: `${i.stock_qty} ${i.stock_unit}`, itemNote: i.item_note || '', category:''
                      })) || []
                      setCart(items); showToast('品項已重新加入購物車'); setNav('cart')
                    }}
                      style={{ background:'#185FA5', color:C.white, border:'none', padding:'6px 14px', borderRadius:7, fontSize:12, cursor:'pointer' }}>
                      一鍵重加購物車
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
