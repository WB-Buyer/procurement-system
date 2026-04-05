import { useState } from 'react'
import StaffApp from './StaffApp'
import ManagerApp from './ManagerApp'
import PurchasingApp from './PurchasingApp'

export default function AdminApp({ profile, onLogout }) {
  const [viewAs, setViewAs] = useState('purchasing')

  const mockProfile = (role) => ({
    ...profile,
    role,
    store_name: role === 'purchasing' ? '採購部' : '信義門市'
  })

  const views = {
    purchasing: <PurchasingApp profile={mockProfile('purchasing')} onLogout={onLogout} />,
    manager: <ManagerApp profile={mockProfile('manager')} onLogout={onLogout} />,
    staff: <StaffApp profile={mockProfile('staff')} onLogout={onLogout} />,
  }

  return (
    <div>
      <div style={{
        background: '#1A2F4A',
        padding: '8px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }}>
        <span style={{ color: '#B2C8D8', fontSize: 12 }}>
          管理員視角切換：
        </span>
        {[
          { key: 'purchasing', label: '採購人員' },
          { key: 'manager', label: '門市店長' },
          { key: 'staff', label: '門市員工' },
        ].map(v => (
          <button key={v.key} onClick={() => setViewAs(v.key)}
            style={{
              padding: '4px 14px',
              borderRadius: 20,
              fontSize: 12,
              cursor: 'pointer',
              border: 'none',
              background: viewAs === v.key ? '#0D7E7E' : '#223650',
              color: viewAs === v.key ? '#fff' : '#B2C8D8',
            }}>
            {v.label}
          </button>
        ))}
        <span style={{
          marginLeft: 'auto',
          background: '#F0A500',
          color: '#1A2F4A',
          fontSize: 11,
          fontWeight: 500,
          padding: '2px 10px',
          borderRadius: 20
        }}>
          超級管理員
        </span>
        <button onClick={onLogout} style={{
          background: 'transparent',
          border: '1px solid #334D65',
          color: '#B2C8D8',
          padding: '4px 12px',
          borderRadius: 6,
          fontSize: 12,
          cursor: 'pointer'
        }}>
          登出
        </button>
      </div>
      {views[viewAs]}
    </div>
  )
}