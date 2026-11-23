import { act, cleanup, render, screen, waitFor, type RenderResult } from '@testing-library/react';
import { Suspense } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import SavePreviewPage from './page';

vi.mock('@/components/auth/SignInButtons', () => ({
  SignInButtons: ({ callbackURL }: { callbackURL: string }) => (
    <a href={callbackURL}>Continue with Google</a>
  ),
}));

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
  vi.unstubAllGlobals();
  useAuthStore.setState(useAuthStore.getInitialState());
});

it('restores the moved layout after sign-in and sends it to the account endpoint', async () => {
  const id = '0af78169-b8ae-44e4-a9ff-d8895b78ae93';
  const copy = 'a1dd19ae-ae37-4147-b69b-0b69bb6f601c';
  const path = `/share/${id}/save?copy=${copy}`;
  const params = Promise.resolve({ id });
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({
      label: 'Search',
      nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: {} }],
      edges: [],
    }))
    .mockResolvedValueOnce(Response.json({ error: 'Canvas limit reached' }, { status: 400 }));
  vi.stubGlobal('fetch', fetchMock);
  window.history.replaceState({}, '', `${path}#${encodeURIComponent('[["a",20,40]]')}`);
  useAuthStore.setState({ user: null, loading: false });
  const page = async () => {
    let result!: RenderResult;
    await act(async () => {
      result = render(<Suspense fallback={null}><SavePreviewPage params={params} /></Suspense>);
    });
    return result;
  };

  const guest = await page();
  expect((await screen.findByRole('link', { name: 'Continue with Google' })).getAttribute('href')).toBe(path);
  expect(fetchMock).not.toHaveBeenCalled();
  guest.unmount();

  window.history.replaceState({}, '', path);
  act(() => useAuthStore.setState({
    user: { id: 'signed-in', email: null, name: null, image: null, emailVerified: true, createdAt: new Date() },
  }));
  await page();
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(fetchMock.mock.calls[1][0]).toBe('/api/user/canvases');
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
    id: copy, name: 'Search', nodes: [{ id: 'a', position: { x: 20, y: 40 } }], edges: [],
  });
  expect((await screen.findByRole('alert')).textContent).toBe('Canvas limit reached');
});
