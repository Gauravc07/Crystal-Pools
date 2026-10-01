import PoolBentoSection from '../components/PoolBentoSection';
import { usePageMeta } from '../hooks/usePageMeta';
import { usePageContent } from '../lib/pageContent';
import { poolTypesPage } from '../content/pages/hubs';

export default function PoolTypes() {
  const c = usePageContent(poolTypesPage);
  usePageMeta(c.text('seo.title'), c.text('seo.description'));
  return (
    <div className="w-full">
      <PoolBentoSection />
    </div>
  );
}


