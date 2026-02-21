'use client'

import { ArrowLeftOutlined, DeleteOutlined, HeartFilled } from '@ant-design/icons'
import { Button, Empty, Popconfirm } from 'antd'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import type { CollectItem } from '@/types'
import styles from './page.module.css'

const COLLECT_STORAGE_KEY = 'punchliner_collects'

export default function CollectPage() {
  const router = useRouter()
  const [collects, setCollects] = useState<CollectItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    try {
      const data = localStorage.getItem(COLLECT_STORAGE_KEY)
      if (data) {
        setCollects(JSON.parse(data))
      }
    } catch (error) {
      console.error('Failed to load collects:', error)
    }
    setLoading(false)
  }, [])

  const handleRemove = (id: string) => {
    const newCollects = collects.filter((item) => item.id !== id)
    localStorage.setItem(COLLECT_STORAGE_KEY, JSON.stringify(newCollects))
    setCollects(newCollects)
    toast.success('已删除')
  }

  const handleClearAll = () => {
    localStorage.removeItem(COLLECT_STORAGE_KEY)
    setCollects([])
    toast.success('已清空所有收藏')
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button
          type="button"
          onClick={() => router.back()}
          className={styles.backBtn}
          aria-label="返回"
        >
          <ArrowLeftOutlined />
        </button>
        <h1 className={styles.title}>
          <HeartFilled className={styles.heartIcon} />
          我的收藏
        </h1>
        {collects.length > 0 && (
          <Popconfirm
            title="确定清空所有收藏？"
            description="此操作不可恢复"
            onConfirm={handleClearAll}
            okText="确定"
            cancelText="取消"
          >
            <Button type="text" danger size="small">
              清空
            </Button>
          </Popconfirm>
        )}
      </header>

      <main className={styles.main}>
        {loading ? (
          <div className={styles.loading}>加载中...</div>
        ) : collects.length === 0 ? (
          <Empty
            description="暂无收藏"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            className={styles.empty}
          >
            <Link href="/">
              <Button type="primary">去发现段子</Button>
            </Link>
          </Empty>
        ) : (
          <div className={styles.list}>
            {collects.map((item) => (
              <div key={item.id} className={styles.card}>
                <Link
                  href={`/joke/${item.id}?content=${encodeURIComponent(item.content)}&time=${item.updateTime}`}
                  className={styles.cardContent}
                >
                  <p className={styles.cardText}>{item.content}</p>
                  <div className={styles.cardMeta}>
                    <span className={styles.cardTime}>收藏于 {formatDate(item.collectTime)}</span>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => handleRemove(item.id)}
                  className={styles.removeBtn}
                  aria-label="删除"
                >
                  <DeleteOutlined />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
