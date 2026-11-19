import {it,expect,vi,afterEach} from 'vitest';
import {deviceLabel,idleState,createIdleTimer} from './session-security';
afterEach(()=>vi.useRealTimers());
it('idle warning starts at limit and signs out once after exactly 60 seconds',()=>{
 vi.useFakeTimers();vi.setSystemTime(0);const change=vi.fn(),expire=vi.fn(),timer=createIdleTimer(15,change,expire);
 vi.advanceTimersByTime(899000);expect(expire).not.toHaveBeenCalled();expect(change.mock.lastCall?.[0].warning).toBe(false);
 vi.advanceTimersByTime(1000);expect(change.mock.lastCall?.[0]).toEqual({warning:true,expired:false,remaining:60});vi.advanceTimersByTime(59000);expect(expire).not.toHaveBeenCalled();vi.advanceTimersByTime(1000);expect(expire).toHaveBeenCalledTimes(1);vi.advanceTimersByTime(60000);expect(expire).toHaveBeenCalledTimes(1);timer.stop();
});
it('stay or cross-tab activity resets timeout; old/future events cannot extend it',()=>{
 vi.useFakeTimers();vi.setSystemTime(0);const change=vi.fn(),expire=vi.fn(),timer=createIdleTimer(15,change,expire);vi.advanceTimersByTime(900000);timer.activity();expect(change.mock.lastCall?.[0].warning).toBe(false);timer.activity(0);timer.activity(Date.now()+600000);vi.advanceTimersByTime(900000);expect(change.mock.lastCall?.[0].warning).toBe(true);expect(expire).not.toHaveBeenCalled();timer.stop();
});
it('initial activity survives reload and sleep is checked against actual wall clock',()=>{
 expect(idleState(0,60,3600000)).toEqual({warning:true,expired:false,remaining:60});vi.useFakeTimers();vi.setSystemTime(960000);const expire=vi.fn(),timer=createIdleTimer(15,vi.fn(),expire,0);timer.check();expect(expire).toHaveBeenCalledTimes(1);timer.stop();
});
it.each([['Mozilla Windows Chrome/1 Safari/1','Chrome on Windows'],['Mozilla Windows Chrome/1 Edg/1','Edge on Windows'],['iPhone Version/1 Safari/1','Safari on iPhone'],['iPad FxiOS/1','Firefox on iPad'],['Android Chrome/1','Chrome on Android'],[null,'Unknown device']])('device labels %s', (ua,expected)=>expect(deviceLabel(ua)).toBe(expected));