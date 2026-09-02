import PoolBentoSection from '../components/PoolBentoSection';
import { usePageMeta } from '../hooks/usePageMeta';

export default function PoolTypes() {
  usePageMeta(
    'Swimming Pool Types',
    'Explore all type of swimming pools in India — private, commercial, competition, vanishing edge, overflow, skimmer, and readymade FRP pools — from Crystal Pools.',
  );
  return (
    <div className="w-full">
      <PoolBentoSection />
    </div>
  );
}


