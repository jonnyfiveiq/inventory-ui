import { useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardTitle,
  Form,
  FormGroup,
  TextInput,
} from '@patternfly/react-core';

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Test credentials against the API
    try {
      const res = await fetch('/api/inventory/v1/providers/', {
        headers: {
          Authorization: `Basic ${btoa(`${username}:${password}`)}`,
        },
      });

      if (res.ok) {
        localStorage.setItem('inventory_creds', `${username}:${password}`);
        onLogin();
      } else {
        setError('Invalid username or password');
      }
    } catch {
      setError('Cannot reach the inventory service');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'var(--pf-v5-global--BackgroundColor--dark-100)',
      }}
    >
      <Card style={{ width: 400 }}>
        <CardTitle>
          <strong>Inventory Service</strong>
        </CardTitle>
        <CardBody>
          <Form onSubmit={handleSubmit}>
            <FormGroup label="Username" isRequired fieldId="username">
              <TextInput
                id="username"
                value={username}
                onChange={(_e, v) => setUsername(v)}
                isRequired
              />
            </FormGroup>
            <FormGroup label="Password" isRequired fieldId="password">
              <TextInput
                id="password"
                type="password"
                value={password}
                onChange={(_e, v) => setPassword(v)}
                isRequired
              />
            </FormGroup>
            {error && (
              <p style={{ color: 'var(--pf-v5-global--danger-color--100)' }}>
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" isBlock style={{ marginTop: '1rem' }}>
              Log in
            </Button>
          </Form>
        </CardBody>
      </Card>
    </div>
  );
}
