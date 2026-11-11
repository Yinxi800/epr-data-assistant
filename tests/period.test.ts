import {describe,it,expect} from 'vitest';
import {periodRange} from '../src/core/period';
describe('自然期间边界',()=>{
 it('月度区分闰年与普通年',()=>{expect(periodRange(2024,2,1)).toEqual({start:'2024-02-01',end:'2024-02-29'});expect(periodRange(2025,2,1).end).toBe('2025-02-28');});
 it('季度覆盖首末季度完整日期',()=>{expect(periodRange(2026,1,3)).toEqual({start:'2026-01-01',end:'2026-03-31'});expect(periodRange(2026,10,3)).toEqual({start:'2026-10-01',end:'2026-12-31'});});
 it('年度完整覆盖全年',()=>{expect(periodRange(2024,1,12)).toEqual({start:'2024-01-01',end:'2024-12-31'});});
});
