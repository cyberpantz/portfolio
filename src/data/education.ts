export interface Study {
  school: string;
  award: string;
  detail?: string;
  yr: string;
}

/**
 * From Frank_Young_Resume_2026_DesignTechnologist.pdf.
 * Physical geography and GIS is an unusually direct origin story for
 * someone who spent a decade on energy dashboards and data
 * visualization, so it earns a line on the page rather than living
 * only on the CV.
 */
export const EDUCATION: Study[] = [
  {
    school: 'Humboldt State University',
    award: 'B.A. Physical Geography / GIS',
    detail: 'Minor: Environmental Ethics',
    yr: '2000',
  },
  {
    school: 'Humboldt State University',
    award: 'Graduate Certificate, GIS & Remote Sensing',
    yr: '2000',
  },
  {
    school: 'Contra Costa College',
    award: 'A.A. Interdisciplinary Studies',
    yr: '1997',
  },
];
