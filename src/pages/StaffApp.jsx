import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const CATEGORIES = ['全部', '保養品', '美容耗材', '微整針劑', '藥品', '醫療耗材', '手術耗材', '手術器械']
const UNITS = ['支', '瓶', '盒', '個', '片', '卷', '件', '顆', '包']

export default function StaffApp({ profile, onLogout }) {
  const [nav, setNav] = useState('catalog')
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
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

  useEffect(() => { fetchProducts() }, [])
  useEffect(() => { if (nav === 'myreqs') fetchMyReqs() }, [nav])

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

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  function openModal(product) {
    setModalProduct(product)
    setStockQty(''); setStockUnit(''); setItemNote('')
    setReqCount('')
  }

  function confirmAddToCart() {
    if (!reqCount || !stockQty || !stockUnit) { alert('請選擇請購數量、庫存數量與單位（必填）'); return }
    setCart(prev => [...prev, { ...modalProduct,reqQty: parseInt(reqCount), stockInfo: `${stockQty} ${stockUnit}`, itemNote }])
    setModalProduct(null)
    showToast(`已加入購物車：${modalProduct.name}`)
  }

  function changeQty(idx, delta) {
    setCart(prev => prev.map((item, i) => i === idx ? { ...item, reqQty: Math.max(1, item.reqQty + delta) } : item))
  }

  function removeFromCart(idx) {
    setCart(prev => prev.filter((_, i) => i !== idx))
  }

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
      stock_qty: parseInt(stockQty) || 0,
      stock_unit: item.stockInfo.split(' ')[1] || '',
      item_note: item.itemNote || ''
    }))
    await supabase.from('requisition_items').insert(items)
    setCart([])
    setSubmitNote('')
    setSubmitting(false)
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
    manager_approved: { bg:'#E6F1FB', color:'#0C447C' },
    ordered: { bg:'#D9F2E6', color:'#1A4A2E' },
    rejected: { bg:'#FDEAEA', color:'#B83232' }
  }

  const navItems = [
    { id:'catalog', icon:'🗂', label:'商品目錄' },
    { id:'cart', icon:'🛒', label:'購物車', badge: cart.length },
    { id:'myreqs', icon:'📋', label:'我的請購' },
  ]

  return (
    <Layout profile={profile} onLogout={onLogout} navItems={navItems} activeNav={nav} onNav={setNav}>
      {toast && (
        <div style={{ background:'#1A2F4A', color:'#fff', padding:'10px 16px', borderRadius:8, fontSize:13, marginBottom:16 }}>{toast}</div>
      )}

      {/* CATALOG */}
      {nav === 'catalog' && (
        <div>
          <h2 style={{ fontSize:18, fontWeight:700, marginBottom:16 }}>商品目錄</h2>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋品項名稱..."
            style={{ width:'100%', padding:'9px 14px', border:'1px solid #D8E4EC', borderRadius:8, fontSize:13, marginBottom:14, background:'#fff' }} />
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setActiveCat(cat)}
                style={{ padding:'5px 14px', borderRadius:20, border:'1px solid', fontSize:12, cursor:'pointer',
                  background: activeCat === cat ? '#0D7E7E' : '#fff',
                  color: activeCat === cat ? '#fff' : '#6B7C8A',
                  borderColor: activeCat === cat ? '#0D7E7E' : '#D8E4EC' }}>
                {cat}
              </button>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:12 }}>
            {filtered.map(p => (
              <div key={p.id} style={{ background:'#fff', border:'1px solid #D8E4EC', borderRadius:12, padding:16 }}>
                <span style={{ background:'#E0F5F5', color:'#085A5A', fontSize:10, fontWeight:500, padding:'2px 8px', borderRadius:20, display:'inline-block', marginBottom:8 }}>{p.category}</span>
                <div style={{ fontSize:13, fontWeight:500, marginBottom:4, lineHeight:1.4 }}>{p.name}</div>
                <div style={{ fontSize:11, color:'#6B7C8A', marginBottom:12 }}>請購單位：{p.unit}</div>
                <button onClick={() => openModal(p)}
                  style={{ width:'100%', background:'#0D7E7E', color:'#fff', border:'none', padding:'7px', borderRadius:7, fontSize:12, cursor:'pointer' }}>
                  加入購物車
                </button>
              </div>
            ))}
          </div>
          {filtered.length === 0 && <div style={{ textAlign:'center', color:'#6B7C8A', padding:'40px 0' }}>找不到符合的品項</div>}
        </div>
      )}

      {/* MODAL */}
      {modalProduct && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#fff', borderRadius:14, padding:24, width:360, maxWidth:'90vw' }}>
            <h3 style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>加入購物車</h3>
            <p style={{ fontSize:12, color:'#6B7C8A', marginBottom:18 }}>{modalProduct.name}</p>
            <div style={{ marginBottom:14 }}>
  <label style={{ fontSize:12, color:'#6B7C8A', display:'block', marginBottom:6 }}>
    請購數量 <span style={{ color:'#B83232' }}>★ 必填</span>
  </label>
  <select value={reqCount} onChange={e => setReqCount(e.target.value)}
    style={{ width:'100%', padding:'8px 10px', border:'1px solid #D8E4EC', borderRadius:7, fontSize:13 }}>
    <option value="">選擇數量</option>
    {Array.from({length:100}, (_, i) => i + 1).map(n => <option key={n}>{n}</option>)}
  </select>
</div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, color:'#6B7C8A', display:'block', marginBottom:6 }}>
                目前庫存數量 <span style={{ color:'#B83232' }}>★ 必填</span>
              </label>
              <div style={{ display:'flex', gap:8 }}>
                <select value={stockQty} onChange={e => setStockQty(e.target.value)}
                  style={{ flex:1, padding:'8px 10px', border:'1px solid #D8E4EC', borderRadius:7, fontSize:13 }}>
                  <option value="">選擇數量</option>
                  {Array.from({length:500}, (_, i) => i + 1).map(n => <option key={n}>{n}</option>)}
                </select>
                <select value={stockUnit} onChange={e => setStockUnit(e.target.value)}
                  style={{ flex:1, padding:'8px 10px', border:'1px solid #D8E4EC', borderRadius:7, fontSize:13 }}>
                  <option value="">選擇單位</option>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom:18 }}>
              <label style={{ fontSize:12, color:'#6B7C8A', display:'block', marginBottom:6 }}>備註 / 請購原因</label>
              <textarea value={itemNote} onChange={e => setItemNote(e.target.value)}
                placeholder="可自由填寫，不限字數..." rows={3}
                style={{ width:'100%', padding:'8px 10px', border:'1px solid #D8E4EC', borderRadius:7, fontSize:13, resize:'vertical' }} />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setModalProduct(null)}
                style={{ flex:1, padding:'9px', border:'1px solid #D8E4EC', borderRadius:8, background:'#F5F8FA', fontSize:13, cursor:'pointer' }}>
                取消
              </button>
              <button onClick={confirmAddToCart}
                style={{ flex:1, padding:'9px', background:'#0D7E7E', color:'#fff', border:'none', borderRadius:8, fontSize:13, cursor:'pointer', fontWeight:500 }}>
                確認加入
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CART */}
      {nav === 'cart' && (
        <div>
          <h2 style={{ fontSize:18, fontWeight:700, marginBottom:16 }}>購物車</h2>
          {cart.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 0', color:'#6B7C8A' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🛒</div>
              <p style={{ marginBottom:16 }}>購物車是空的</p>
              <button onClick={() => setNav('catalog')}
                style={{ background:'#0D7E7E', color:'#fff', border:'none', padding:'9px 20px', borderRadius:8, fontSize:13, cursor:'pointer' }}>
                前往商品目錄
              </button>
            </div>
          ) : (
            <div style={{ background:'#fff', border:'1px solid #D8E4EC', borderRadius:12, padding:20 }}>
              {cart.map((item, idx) => (
                <div key={idx} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom:'1px solid #EEF3F5' }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:500 }}>{item.name}</div>
                    <div style={{ fontSize:11, color:'#6B7C8A', marginTop:2 }}>庫存：{item.stockInfo}{item.itemNote ? `　備註：${item.itemNote}` : ''}</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <button onClick={() => changeQty(idx, -1)} style={{ width:28, height:28, border:'1px solid #D8E4EC', borderRadius:6, background:'#F5F8FA', cursor:'pointer', fontSize:14 }}>-</button>
                    <span style={{ fontSize:13, minWidth:24, textAlign:'center' }}>{item.reqQty}</span>
                    <button onClick={() => changeQty(idx, 1)} style={{ width:28, height:28, border:'1px solid #D8E4EC', borderRadius:6, background:'#F5F8FA', cursor:'pointer', fontSize:14 }}>+</button>
                    <button onClick={() => removeFromCart(idx)} style={{ width:28, height:28, border:'1px solid #F09595', borderRadius:6, background:'#FDEAEA', cursor:'pointer', color:'#B83232', fontSize:14 }}>×</button>
                  </div>
                </div>
              ))}
              <div style={{ marginTop:20, display:'flex', flexDirection:'column', gap:12 }}>
                <div>
                  <label style={{ fontSize:12, color:'#6B7C8A', display:'block', marginBottom:6 }}>送單日期</label>
                  <input type="date" value={submitDate} onChange={e => setSubmitDate(e.target.value)}
                    style={{ padding:'8px 12px', border:'1px solid #D8E4EC', borderRadius:7, fontSize:13 }} />
                </div>
                <div>
                  <label style={{ fontSize:12, color:'#6B7C8A', display:'block', marginBottom:6 }}>整單備註（選填）</label>
                  <input value={submitNote} onChange={e => setSubmitNote(e.target.value)} placeholder="如：急件優先處理"
                    style={{ width:'100%', padding:'8px 12px', border:'1px solid #D8E4EC', borderRadius:7, fontSize:13 }} />
                </div>
                <button onClick={submitRequisition} disabled={submitting}
                  style={{ padding:'11px', background:'#0D7E7E', color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:500, cursor:'pointer', marginTop:4 }}>
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
          <h2 style={{ fontSize:18, fontWeight:700, marginBottom:16 }}>我的請購</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {myReqs.length === 0 && <div style={{ color:'#6B7C8A', textAlign:'center', padding:'40px 0' }}>尚無請購紀錄</div>}
            {myReqs.map(req => {
              const s = statusStyle[req.status] || statusStyle.pending
              const label = statusMap[req.status] || req.status
              return (
                <div key={req.id} style={{ background:'#fff', border:'1px solid #D8E4EC', borderRadius:12, padding:16 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500 }}>#{req.id.slice(0,8).toUpperCase()}</div>
                      <div style={{ fontSize:11, color:'#6B7C8A', marginTop:2 }}>{req.store_name}　{req.submit_date}</div>
                      {req.note && <div style={{ fontSize:11, color:'#6B7C8A' }}>備註：{req.note}</div>}
                    </div>
                    <span style={{ background:s.bg, color:s.color, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, whiteSpace:'nowrap' }}>{label}</span>
                  </div>
                  <div style={{ fontSize:12, color:'#6B7C8A', marginBottom: req.status === 'rejected' ? 10 : 0 }}>
                    {req.requisition_items?.map(i => `${i.products?.name} ×${i.quantity}`).join('、')}
                  </div>
                  {req.status === 'rejected' && req.reject_reason && (
                    <div style={{ background:'#FDEAEA', color:'#B83232', padding:'6px 10px', borderRadius:6, fontSize:12, marginBottom:10 }}>
                      退回原因：{req.reject_reason}
                    </div>
                  )}
                  {req.status === 'rejected' && (
                    <button onClick={() => {
                      const items = req.requisition_items?.map(i => ({
                        id: i.product_id, name: i.products?.name, unit: i.products?.unit,
                        reqQty: i.quantity, stockInfo: `${i.stock_qty} ${i.stock_unit}`, itemNote: i.item_note || '', category:''
                      })) || []
                      setCart(items)
                      showToast('品項已重新加入購物車')
                      setNav('cart')
                    }}
                      style={{ background:'#185FA5', color:'#fff', border:'none', padding:'6px 14px', borderRadius:7, fontSize:12, cursor:'pointer' }}>
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
