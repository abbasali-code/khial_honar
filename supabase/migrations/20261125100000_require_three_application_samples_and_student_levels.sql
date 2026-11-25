alter table public.academy_applications
  add column if not exists sample_work_urls text[] not null default '{}'::text[],
  add column if not exists skill_level text;
alter table public.academy_students add column if not exists skill_level text;
alter table public.academy_applications drop constraint if exists academy_applications_skill_level_check;
alter table public.academy_applications add constraint academy_applications_skill_level_check
  check (skill_level is null or skill_level in ('beginner','intermediate','professional'));
alter table public.academy_students drop constraint if exists academy_students_skill_level_check;
alter table public.academy_students add constraint academy_students_skill_level_check
  check (skill_level is null or skill_level in ('beginner','intermediate','professional'));
alter table public.academy_applications drop constraint if exists academy_applications_sample_work_urls_check;
alter table public.academy_applications add constraint academy_applications_sample_work_urls_check
  check (cardinality(sample_work_urls) <= 6);

create or replace function public.enroll_academy_application(application_id uuid)
returns uuid language plpgsql security definer
set search_path to 'public', 'private', 'auth'
as $function$
declare app public.academy_applications%rowtype; new_student_id uuid; matched_user_id uuid;
begin
  if auth.uid() is null or not private.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  select * into app from public.academy_applications where id = application_id for update;
  if not found then raise exception 'Application not found' using errcode = 'P0002'; end if;
  if app.dismissed_at is not null then raise exception 'Application is dismissed'; end if;
  if app.skill_level is null or app.skill_level not in ('beginner','intermediate','professional') then
    raise exception 'ابتدا سطح هنرجو را مشخص کن.';
  end if;
  if app.created_at >= timestamptz '2026-11-25 00:00:00+00'
     and cardinality(coalesce(app.sample_work_urls, '{}'::text[])) < 3 then
    raise exception 'برای ثبت هنرجو حداقل سه نمونه‌کار لازم است.';
  end if;
  if app.email is not null then
    select u.id into matched_user_id from auth.users u where lower(u.email)=lower(app.email) limit 1;
  end if;
  select id into new_student_id from public.academy_students where source_application_id=app.id;
  if new_student_id is null then
    insert into public.academy_students
      (display_name,bio,avatar_url,avatar_emoji,published,source_application_id,user_id,skill_level)
    values
      (coalesce(nullif(btrim(app.display_name),''),app.full_name),nullif(btrim(app.message),''),app.avatar_url,app.avatar_emoji,true,app.id,matched_user_id,app.skill_level)
    returning id into new_student_id;
  else
    update public.academy_students set user_id=coalesce(user_id,matched_user_id),skill_level=app.skill_level where id=new_student_id;
  end if;
  update public.academy_applications set status='enrolled',reviewed_at=now(),reviewed_by=auth.uid() where id=app.id;
  return new_student_id;
end;
$function$;
