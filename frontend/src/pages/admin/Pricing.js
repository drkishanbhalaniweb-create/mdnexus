import { useState, useEffect } from 'react';
import { DollarSign, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

const Pricing = () => {
  const [pricing, setPricing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPricing();
  }, []);

  const fetchPricing = async () => {
    try {
      const { data, error } = await supabase
        .from('service_pricing')
        .select('*')
        .order('service_name');

      if (error) throw error;
      setPricing(data || []);
    } catch (error) {
      console.error('Error fetching pricing:', error);
      toast.error('Failed to load pricing');
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (id, field, value) => {
    setPricing(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, [field]: field === 'is_active' ? value : parseInt(value) || 0 }
          : item
      )
    );
  };

  const handleSave = async (item) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('service_pricing')
        .update({
          base_price: item.base_price,
          rush_fee: item.rush_fee,
          is_active: item.is_active,
          description: item.description,
        })
        .eq('id', item.id);

      if (error) throw error;
      toast.success('Pricing updated successfully');
    } catch (error) {
      console.error('Error updating pricing:', error);
      toast.error('Failed to update pricing');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (cents) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Pricing</h1>
          <p className="text-gray-600 mt-1">Manage pricing for all services</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start">
        <AlertCircle className="w-5 h-5 text-amber-600 mr-3 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-amber-800">
          <p className="font-semibold mb-1">Important:</p>
          <p>Changes to pricing will take effect immediately for new purchases. Prices are stored in cents (e.g., 22500 = $225.00).</p>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Base Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rush Fee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total (with Rush)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pricing.map((item) => (
                <tr key={item.id} className={!item.is_active ? 'bg-gray-50' : ''}>
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{item.service_name}</div>
                      <div className="text-xs text-gray-500">{item.service_type}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="w-4 h-4 text-gray-400" />
                      <input
                        type="number"
                        value={item.base_price}
                        onChange={(e) => handlePriceChange(item.id, 'base_price', e.target.value)}
                        className="w-28 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="22500"
                      />
                      <span className="text-xs text-gray-500">
                        ({formatCurrency(item.base_price)})
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="w-4 h-4 text-gray-400" />
                      <input
                        type="number"
                        value={item.rush_fee}
                        onChange={(e) => handlePriceChange(item.id, 'rush_fee', e.target.value)}
                        className="w-28 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="0"
                      />
                      <span className="text-xs text-gray-500">
                        ({formatCurrency(item.rush_fee)})
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(item.base_price + item.rush_fee)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.is_active}
                        onChange={(e) => handlePriceChange(item.id, 'is_active', e.target.checked)}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        {item.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </label>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleSave(item)}
                      disabled={saving}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4 mr-1" />
                      Save
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Price Conversion Guide</h3>
        <div className="text-sm text-blue-800 space-y-1">
          <p>• $100.00 = 10000 cents</p>
          <p>• $225.00 = 22500 cents</p>
          <p>• $500.00 = 50000 cents</p>
          <p>• $1,500.00 = 150000 cents</p>
          <p>• $2,000.00 = 200000 cents</p>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
