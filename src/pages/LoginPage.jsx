import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('帳號或密碼錯誤，請重新輸入')
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#1A2F4A', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'#fff', borderRadius:16, padding:'40px 36px', width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:52, height:52, background:'#E0F5F5', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0D7E7E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
            </svg>
          </div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#1A2F4A', marginBottom:4 }}>醫美門市請購系統</h1>
          <p style={{ fontSize:13, color:'#6B7C8A' }}>請輸入帳號密碼登入</p>
        </div>

        <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={{ fontSize:12, color:'#6B7C8A', display:'block', marginBottom:6 }}>Email 帳號</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="your@email.com"
              style={{ width:'100%', padding:'10px 14px', border:'1px solid #D8E4EC', borderRadius:8, fontSize:14, outline:'none' }}
            />
          </div>
          <div>
            <label style={{ fontSize:12, color:'#6B7C8A', display:'block', marginBottom:6 }}>密碼</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              placeholder="••••••••"
              style={{ width:'100%', padding:'10px 14px', border:'1px solid #D8E4EC', borderRadius:8, fontSize:14, outline:'none' }}
            />
          </div>
          {error && <div style={{ background:'#FDEAEA', color:'#B83232', padding:'8px 12px', borderRadius:6, fontSize:13 }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ background:'#0D7E7E', color:'#fff', border:'none', padding:'12px', borderRadius:8, fontSize:14, fontWeight:500, marginTop:4 }}>
            {loading ? '登入中...' : '登入'}
          </button>
        </form>
      </div>
    </div>
  )
}
