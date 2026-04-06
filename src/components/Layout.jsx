import { useState } from 'react'

const C = {
  primary: '#C4B1A0',
  primaryDark: '#A59482',
  primaryLight: '#EDE5DC',
  primaryLighter: '#F7F3EF',
  navy: '#3D3530',
  white: '#FFFFFF',
  border: '#D9CEC5',
  sidebar: '#F7F3EF',
  topbar: '#3D3530',
  text: '#3D3530',
  textMuted: '#A59482',
  active: '#C4B1A0',
  activeBg: '#EDE5DC',
  badge: '#A59482',
}

export default function Layout({ profile, onLogout, navItems, activeNav, onNav, children }) {
  const [collapsed, setCollapsed] = useState(false)

  const roleLabel = { staff:'門市員工', manager:'門市店長', purchasing:'採購人員', admin:'超級管理員' }
  const roleColor = { staff:'#EDE5DC', manager:'#EDE5DC', purchasing:'#EDE5DC', admin:'#C4B1A0' }
  const roleText = { staff:'#A59482', manager:'#A59482', purchasing:'#A59482', admin:'#3D3530' }

  const homeNav = { staff:'catalog', manager:'pending', purchasing:'dashboard', admin:'dashboard' }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      <div style={{ background:C.primaryLight, padding:'0 20px', display:'flex', alignItems:'center', justifyContent:'space-between', height:52, flexShrink:0, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={() => setCollapsed(p => !p)}
            style={{ background:'transparent', border:'none', color:C.primaryDark, cursor:'pointer', padding:'4px 6px', borderRadius:6, fontSize:18, lineHeight:1, display:'flex', alignItems:'center' }}>
            {collapsed ? '☰' : '✕'}
          </button>
          <div onClick={() => onNav(homeNav[profile?.role] || 'catalog')}
            style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
            <div style={{ width:36, height:36, borderRadius:'50%', overflow:'hidden', background:'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <img src="/logo.png" alt="logo" style={{ width:'100%', height:'100%', objectFit:'cover' }}
                onError={e => { e.target.style.display='none'; e.target.parentNode.innerHTML=`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C4B1A0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>` }} />
            </div>
            <span style={{ color:C.text, fontWeight:700, fontSize:14 }}>晶緻集團請購系統</span>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ background:roleColor[profile?.role], color:roleText[profile?.role], fontSize:11, fontWeight:500, padding:'3px 10px', borderRadius:20 }}>
            {roleLabel[profile?.role]}
          </span>
          <span style={{ color:'#C4B1A0', fontSize:13 }}>{profile?.full_name || profile?.store_name}</span>
          <button onClick={onLogout}
            style={{ background:'transparent', border:'1px solid #5D5048', color:'#C4B1A0', padding:'4px 12px', borderRadius:6, fontSize:12, cursor:'pointer' }}>
            登出
          </button>
        </div>
      </div>

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <div style={{
          width: collapsed ? 0 : 180,
          minWidth: collapsed ? 0 : 180,
          background: C.sidebar,
          borderRight: `1px solid ${C.border}`,
          padding: collapsed ? 0 : '12px 0',
          flexShrink:0, overflowY:'auto', overflowX:'hidden',
          transition:'all .2s ease'
        }}>
          {!collapsed && navItems.map(item => (
            <div key={item.id} onClick={() => onNav(item.id)}
              style={{
                padding:'10px 16px', display:'flex', alignItems:'center', gap:10, cursor:'pointer',
                background: activeNav === item.id ? C.activeBg : 'transparent',
                borderLeft: activeNav === item.id ? `3px solid ${C.primary}` : '3px solid transparent',
                color: activeNav === item.id ? C.primaryDark : C.textMuted,
                fontWeight: activeNav === item.id ? 500 : 400,
                fontSize:13, transition:'all .15s', whiteSpace:'nowrap'
              }}>
              <span style={{ fontSize:16 }}>{item.icon}</span>
              <span>{item.label}</span>
              {item.badge > 0 && (
                <span style={{ marginLeft:'auto', background:C.primary, color:'#fff', borderRadius:10, padding:'1px 7px', fontSize:10 }}>{item.badge}</span>
              )}
            </div>
          ))}
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:24, background:'#FAF7F5' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
