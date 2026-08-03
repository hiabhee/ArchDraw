import { describe, it, expect } from 'vitest';
import type { FileEntry } from '@/lib/types/repo-diagram';
import { extractStaticSignals } from '../static-analyzer';

// Phase 5: broadened route-pattern detection across Flask / Django / FastAPI / Redis
// Rails / Spring / GraphQL.

function routeLabels(content: string, path: string): string[] {
  return extractStaticSignals([{ path, content } as FileEntry], [])
    .filter((s) => s.type === 'route')
    .map((s) => s.label);
}

describe('Phase 5 route detection across frameworks', () => {
  it('Flask @app.route + blueprint', () => {
    const labels = routeLabels(`@app.route('/users/<id>')\n@bp.route('/posts')`, 'app.py');
    expect(labels).toContain('/users/<id>');
    expect(labels).toContain('/posts');
  });

  it('FastAPI APIRouter prefix + @router.get', () => {
    const labels = routeLabels(`router = APIRouter(prefix='/api/v1')\n@router.get('/items')`, 'app/api.py');
    expect(labels).toContain('/api/v1');
    expect(labels).toContain('/items');
  });

  it('Django path() in urls.py', () => {
    const labels = routeLabels(`urlpatterns = [path('users/', views.users), path('posts/<int:pk>/', views.post)]`, 'app/urls.py');
    expect(labels).toContain('users/');
    expect(labels).toContain('posts/<int:pk>/');
  });

  it('Rails config/routes.rb — resources + get', () => {
    const labels = routeLabels(`Rails.application.routes.draw do\n  resources :orders\n  get '/health' to: 'health#show'\n  post '/login' to: 'sessions#create'\nend`, 'config/routes.rb');
    // resources :orders emits an "orders" label.
    expect(labels).toContain('orders');
    expect(labels).toContain('/health');
    expect(labels).toContain('/login');
  });

  it('Spring @GetMapping / @PostMapping', () => {
    const labels = routeLabels(`@GetMapping("/api/users") public ResponseEntity<List<User>> users() {} @PostMapping("/api/orders") public ResponseEntity<Order> create() {}`, 'src/main/java/OrdersController.java');
    expect(labels).toContain('/api/users');
    expect(labels).toContain('/api/orders');
  });

  it('GraphQL type Query field names', () => {
    const labels = routeLabels(`type Query {\n  user(id: ID!): User!\n  posts: [Post!]!\n}\n`, 'schema.graphql');
    expect(labels).toContain('user');
    expect(labels).toContain('posts');
  });

  it('still handles Express router.get', () => {
    const labels = routeLabels(`router.get('/health', (req,res)=>res.send('ok'))`, 'routes/health.js');
    expect(labels).toContain('/health');
  });

  it('still handles Next.js app/api route.ts', () => {
    // The path-based signal (already in the file name check) fires.
    const sigs = extractStaticSignals([{ path: 'app/api/orders/route.ts', content: 'export function GET() {}' } as FileEntry], []);
    expect(sigs.some((s) => s.type === 'route')).toBe(true);
  });
});