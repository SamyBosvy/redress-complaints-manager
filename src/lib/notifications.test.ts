import {it,expect} from 'vitest';
import {notificationLink,notificationLabel,relativeNotificationTime,parseNotificationSearch,alwaysOn} from './notifications';
const id='20000000-0000-4000-8000-000000000001';
it('safe links retain case and notes filter while rejecting external or mismatched destinations',()=>{
 expect(notificationLink({complaint_id:id,link_path:'/app/c/'+id+'?timeline_groups=notes'})).toEqual({id,notes:true});
 expect(notificationLink({complaint_id:id,link_path:'/app/c/'+id+'?tl=notes'})).toEqual({id,notes:true});
 expect(notificationLink({complaint_id:id,link_path:'https://evil.invalid'})).toEqual({id,notes:false});
 expect(notificationLink({complaint_id:null,link_path:'//evil.invalid'})).toBeNull();
});
it('labels and relative time cover known unknown future and elapsed values',()=>{
 expect(notificationLabel('qa_returned')).toBe('QA returned');expect(notificationLabel('__proto__')).toBe('Notification');
 const now=new Date('2026-01-01T12:00:00Z');expect(relativeNotificationTime('2026-01-01T11:58:00Z',now)).toBe('2m ago');expect(relativeNotificationTime('2026-01-01T13:00:00Z',now)).toBe('Just now');expect(relativeNotificationTime('2025-12-30T12:00:00Z',now)).toBe('2d ago');
});
it('validates paging and filters and mandatory preferences',()=>{expect(parseNotificationSearch({kind:'spoof',page:-1}).page).toBe(1);expect(parseNotificationSearch({kind:'mention',unread:'true'})).toEqual({kind:'mention',unread:true,page:1});expect(alwaysOn('mention')).toBe(true);expect(alwaysOn('qa_returned')).toBe(true);expect(alwaysOn('assigned')).toBe(false);});