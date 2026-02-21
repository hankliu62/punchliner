'use client';

import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { Toaster } from 'react-hot-toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#6366f1',
          borderRadius: 12,
        },
        components: {
          Button: {
            controlHeight: 44,
          },
        },
      }}
    >
      <AntApp>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 2000,
            style: {
              borderRadius: '12px',
              background: '#333',
              color: '#fff',
            },
          }}
        />
      </AntApp>
    </ConfigProvider>
  );
}
