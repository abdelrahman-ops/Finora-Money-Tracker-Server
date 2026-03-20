import { describe, it, expect } from 'vitest';
import { parseTransactionInput } from '../src/services/aiParser';

describe('AI Parser', () => {
  it('should parse "20 coffee" as a $20 food expense', () => {
    const result = parseTransactionInput('20 coffee');
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(20);
    expect(result!.type).toBe('expense');
    expect(result!.categoryHint).toBe('Food');
    expect(result!.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('should parse "salary 5000" as income', () => {
    const result = parseTransactionInput('salary 5000');
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(5000);
    expect(result!.type).toBe('income');
    expect(result!.categoryHint).toBe('Salary');
  });

  it('should parse "transfer 100 to bank" as transfer', () => {
    const result = parseTransactionInput('transfer 100 to bank');
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(100);
    expect(result!.type).toBe('transfer');
    expect(result!.accountHint).toBe('bank');
  });

  it('should return null for empty input', () => {
    expect(parseTransactionInput('')).toBeNull();
    expect(parseTransactionInput('   ')).toBeNull();
  });

  it('should detect uber as Transport category', () => {
    const result = parseTransactionInput('50 uber');
    expect(result).not.toBeNull();
    expect(result!.categoryHint).toBe('Transport');
  });

  it('should handle text without amount', () => {
    const result = parseTransactionInput('coffee');
    expect(result).not.toBeNull();
    expect(result!.amount).toBeNull();
    expect(result!.confidence).toBeLessThan(0.5);
  });
});
