/**
 * Query Builder Tests
 */

import { describe, it, expect } from 'vitest';
import {
  SelectBuilder,
  InsertBuilder,
  UpdateBuilder,
  DeleteBuilder,
  selectFrom,
  insertInto,
  update,
  deleteFrom,
  createPaginatedResult,
} from './queryBuilder.js';

describe('QueryBuilder', () => {
  describe('SelectBuilder', () => {
    it('should build basic SELECT query', () => {
      const query = selectFrom('users').build();
      expect(query.text).toBe('SELECT * FROM users');
      expect(query.values).toEqual([]);
    });

    it('should select specific columns', () => {
      const query = selectFrom('users')
        .select('id', 'name', 'email')
        .build();
      expect(query.text).toBe('SELECT id, name, email FROM users');
    });

    it('should handle DISTINCT', () => {
      const query = selectFrom('users')
        .select('status')
        .distinct()
        .build();
      expect(query.text).toBe('SELECT DISTINCT status FROM users');
    });

    it('should handle WHERE with eq operator', () => {
      const query = selectFrom('users')
        .where('id', 'eq', 123)
        .build();
      expect(query.text).toBe('SELECT * FROM users WHERE id = $1');
      expect(query.values).toEqual([123]);
    });

    it('should handle WHERE with multiple conditions', () => {
      const query = selectFrom('users')
        .where('status', 'eq', 'active')
        .where('role', 'eq', 'admin')
        .build();
      expect(query.text).toBe('SELECT * FROM users WHERE status = $1 AND role = $2');
      expect(query.values).toEqual(['active', 'admin']);
    });

    it('should handle comparison operators', () => {
      const query = selectFrom('products')
        .where('price', 'gte', 100)
        .where('stock', 'lt', 50)
        .build();
      expect(query.text).toBe('SELECT * FROM products WHERE price >= $1 AND stock < $2');
      expect(query.values).toEqual([100, 50]);
    });

    it('should handle IN operator', () => {
      const query = selectFrom('users')
        .where('status', 'in', ['active', 'pending'])
        .build();
      expect(query.text).toBe('SELECT * FROM users WHERE status IN ($1, $2)');
      expect(query.values).toEqual(['active', 'pending']);
    });

    it('should handle empty IN operator', () => {
      const query = selectFrom('users')
        .where('status', 'in', [])
        .build();
      expect(query.text).toBe('SELECT * FROM users WHERE 1 = 0');
    });

    it('should handle LIKE operator', () => {
      const query = selectFrom('users')
        .where('name', 'like', '%john%')
        .build();
      expect(query.text).toBe('SELECT * FROM users WHERE name LIKE $1');
      expect(query.values).toEqual(['%john%']);
    });

    it('should handle NULL checks', () => {
      const query = selectFrom('users')
        .where('deleted_at', 'null', null)
        .build();
      expect(query.text).toBe('SELECT * FROM users WHERE deleted_at IS NULL');
    });

    it('should handle BETWEEN operator', () => {
      const query = selectFrom('orders')
        .where('created_at', 'between', ['2024-01-01', '2024-12-31'])
        .build();
      expect(query.text).toBe('SELECT * FROM orders WHERE created_at BETWEEN $1 AND $2');
      expect(query.values).toEqual(['2024-01-01', '2024-12-31']);
    });

    it('should handle ORDER BY', () => {
      const query = selectFrom('users')
        .orderBy('created_at', 'DESC')
        .orderBy('name', 'ASC')
        .build();
      expect(query.text).toBe('SELECT * FROM users ORDER BY created_at DESC, name ASC');
    });

    it('should handle ORDER BY with NULLS', () => {
      const query = selectFrom('users')
        .orderBy('last_login', 'DESC', 'LAST')
        .build();
      expect(query.text).toBe('SELECT * FROM users ORDER BY last_login DESC NULLS LAST');
    });

    it('should handle LIMIT and OFFSET', () => {
      const query = selectFrom('users')
        .limit(10)
        .offset(20)
        .build();
      expect(query.text).toBe('SELECT * FROM users LIMIT 10 OFFSET 20');
    });

    it('should handle pagination', () => {
      const query = selectFrom('users')
        .paginate({ page: 3, pageSize: 25 })
        .build();
      expect(query.text).toBe('SELECT * FROM users LIMIT 25 OFFSET 50');
    });

    it('should handle JOIN', () => {
      const query = selectFrom('orders')
        .join('users', 'orders.user_id = users.id')
        .build();
      expect(query.text).toBe('SELECT * FROM orders INNER JOIN users ON orders.user_id = users.id');
    });

    it('should handle LEFT JOIN', () => {
      const query = selectFrom('users')
        .leftJoin('profiles', 'users.id = profiles.user_id')
        .build();
      expect(query.text).toBe('SELECT * FROM users LEFT JOIN profiles ON users.id = profiles.user_id');
    });

    it('should handle GROUP BY and HAVING', () => {
      const query = selectFrom('orders')
        .select('user_id')
        .groupBy('user_id')
        .having('COUNT(*) > 5')
        .build();
      expect(query.text).toBe('SELECT user_id FROM orders GROUP BY user_id HAVING COUNT(*) > 5');
    });

    it('should handle FOR UPDATE', () => {
      const query = selectFrom('accounts')
        .where('id', 'eq', 1)
        .forUpdate()
        .build();
      expect(query.text).toBe('SELECT * FROM accounts WHERE id = $1 FOR UPDATE');
    });

    it('should build COUNT query', () => {
      const query = selectFrom('users')
        .where('status', 'eq', 'active')
        .buildCount();
      expect(query.text).toBe('SELECT COUNT(*) as count FROM users WHERE status = $1');
    });

    it('should reject invalid identifiers', () => {
      expect(() => selectFrom('users; DROP TABLE--')).toThrow('Invalid identifier');
    });
  });

  describe('InsertBuilder', () => {
    it('should build basic INSERT query', () => {
      const query = insertInto('users')
        .into('name', 'email')
        .values('John', 'john@example.com')
        .build();
      expect(query.text).toBe('INSERT INTO users (name, email) VALUES ($1, $2)');
      expect(query.values).toEqual(['John', 'john@example.com']);
    });

    it('should handle multiple rows', () => {
      const query = insertInto('users')
        .into('name', 'email')
        .values('John', 'john@example.com')
        .values('Jane', 'jane@example.com')
        .build();
      expect(query.text).toBe('INSERT INTO users (name, email) VALUES ($1, $2), ($3, $4)');
      expect(query.values).toEqual(['John', 'john@example.com', 'Jane', 'jane@example.com']);
    });

    it('should handle RETURNING', () => {
      const query = insertInto('users')
        .into('name', 'email')
        .values('John', 'john@example.com')
        .returning('id', 'created_at')
        .build();
      expect(query.text).toBe('INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, created_at');
    });

    it('should handle ON CONFLICT DO NOTHING', () => {
      const query = insertInto('users')
        .into('email', 'name')
        .values('john@example.com', 'John')
        .onConflictDoNothing('email')
        .build();
      expect(query.text).toBe('INSERT INTO users (email, name) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING');
    });

    it('should handle ON CONFLICT DO UPDATE', () => {
      const query = insertInto('users')
        .into('email', 'name', 'updated_at')
        .values('john@example.com', 'John', new Date())
        .onConflictDoUpdate('email', ['name', 'updated_at'])
        .build();
      expect(query.text).toContain('ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, updated_at = EXCLUDED.updated_at');
    });

    it('should throw on mismatched value count', () => {
      expect(() =>
        insertInto('users')
          .into('name', 'email')
          .values('John') // Missing email
          .build()
      ).toThrow("Value count (1) doesn't match column count (2)");
    });
  });

  describe('UpdateBuilder', () => {
    it('should build basic UPDATE query', () => {
      const query = update('users')
        .set('name', 'John Doe')
        .where('id', 'eq', 1)
        .build();
      expect(query.text).toBe('UPDATE users SET name = $1 WHERE id = $2');
      expect(query.values).toEqual(['John Doe', 1]);
    });

    it('should handle multiple SET values', () => {
      const query = update('users')
        .set('name', 'John')
        .set('email', 'john@example.com')
        .where('id', 'eq', 1)
        .build();
      expect(query.text).toBe('UPDATE users SET name = $1, email = $2 WHERE id = $3');
    });

    it('should handle setObject', () => {
      const query = update('users')
        .setObject({ name: 'John', status: 'active' })
        .where('id', 'eq', 1)
        .build();
      expect(query.text).toBe('UPDATE users SET name = $1, status = $2 WHERE id = $3');
    });

    it('should handle setRaw for expressions', () => {
      const query = update('products')
        .setRaw('stock', 'stock - 1')
        .where('id', 'eq', 1)
        .build();
      expect(query.text).toBe('UPDATE products SET stock = stock - 1 WHERE id = $1');
    });

    it('should handle RETURNING', () => {
      const query = update('users')
        .set('status', 'inactive')
        .where('id', 'eq', 1)
        .returning('*')
        .build();
      expect(query.text).toBe('UPDATE users SET status = $1 WHERE id = $2 RETURNING *');
    });
  });

  describe('DeleteBuilder', () => {
    it('should build basic DELETE query', () => {
      const query = deleteFrom('users')
        .where('id', 'eq', 1)
        .build();
      expect(query.text).toBe('DELETE FROM users WHERE id = $1');
      expect(query.values).toEqual([1]);
    });

    it('should handle IN clause', () => {
      const query = deleteFrom('users')
        .where('id', 'in', [1, 2, 3])
        .build();
      expect(query.text).toBe('DELETE FROM users WHERE id IN ($1, $2, $3)');
      expect(query.values).toEqual([1, 2, 3]);
    });

    it('should handle RETURNING', () => {
      const query = deleteFrom('users')
        .where('id', 'eq', 1)
        .returning('id', 'email')
        .build();
      expect(query.text).toBe('DELETE FROM users WHERE id = $1 RETURNING id, email');
    });

    it('should build DELETE without WHERE (dangerous but allowed)', () => {
      const query = deleteFrom('temp_table').build();
      expect(query.text).toBe('DELETE FROM temp_table');
    });
  });

  describe('createPaginatedResult', () => {
    it('should create correct pagination metadata', () => {
      const result = createPaginatedResult(
        [{ id: 1 }, { id: 2 }],
        50,
        { page: 2, pageSize: 10 }
      );

      expect(result.data).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 2,
        pageSize: 10,
        totalCount: 50,
        totalPages: 5,
        hasNextPage: true,
        hasPreviousPage: true,
      });
    });

    it('should handle last page correctly', () => {
      const result = createPaginatedResult(
        [{ id: 1 }],
        21,
        { page: 3, pageSize: 10 }
      );

      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(true);
      expect(result.pagination.totalPages).toBe(3);
    });

    it('should handle first page correctly', () => {
      const result = createPaginatedResult(
        [{ id: 1 }],
        100,
        { page: 1, pageSize: 10 }
      );

      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPreviousPage).toBe(false);
    });
  });
});
