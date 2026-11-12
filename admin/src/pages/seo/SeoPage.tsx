import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import SeoOverview from './SeoOverview';
import SeoRedirects from './SeoRedirects';
import SeoCities from './SeoCities';
import SeoGoogle from './SeoGoogle';
import SeoMonthly from './SeoMonthly';

const TABS = [
  { id: 'pages', label: 'Titles & descriptions', view: SeoOverview },
  { id: 'redirects', label: 'Redirects', view: SeoRedirects },
  { id: 'cities', label: 'City pages', view: SeoCities },
  { id: 'google', label: 'Google & facts', view: SeoGoogle },
  { id: 'monthly', label: 'Monthly report', view: SeoMonthly },
];

export default function SeoPage() {
  const [params, setParams] = useSearchParams();
  const active = TABS.find(t => t.id === params.get('tab')) ?? TABS[0];
  const View = active.view;
  return (
    <>
      <PageHeader title="SEO" description="Everything the SEO team manages. Changes reach the live site within about 5 minutes, with no deployment." />
      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setParams({ tab: t.id })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${t.id === active.id ? 'border-brand-blue text-brand-blue' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <View />
    </>
  );
}
