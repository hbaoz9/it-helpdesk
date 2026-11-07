import { useState } from 'react'
import { Button, Typography } from 'antd'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ padding: 32 }}>
      <Typography.Title level={2}>
        IT Helpdesk
      </Typography.Title>

      <Typography.Paragraph>
        Frontend Scaffold - Ant Design Test
      </Typography.Paragraph>

      <Button
        type="primary"
        onClick={() => setCount((value) => value + 1)}
      >
        Kiểm tra Ant Design: {count}
      </Button>
    </div>
  )
}

export default App