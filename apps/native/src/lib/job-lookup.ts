/** Why a job-scoped screen has no job to render. */
export type JobLookupMiss = 'loading' | 'missing';

/**
 * A `getJob` miss means two different things, and job screens used to collapse
 * both into "Job not found".
 *
 * The provider starts with an empty job list and fills it from
 * `/inspector/inspections`, so on every open of `/jobs/:id` there is a window
 * where the id is real but simply hasn't arrived yet. Rendering not-found there
 * tells the inspector their job is gone while it is loading.
 *
 * `jobsHydrated` (not `loading`) is the right input: a later refresh must not
 * flip the screen back to a spinner.
 *
 * Native also GETs the job by id; wait for that too so a hydrating list does
 * not say missing while the detail fetch is still in flight.
 */
export function jobLookupMiss(jobsHydrated: boolean, idLookupDone = true): JobLookupMiss {
  return jobsHydrated && idLookupDone ? 'missing' : 'loading';
}
