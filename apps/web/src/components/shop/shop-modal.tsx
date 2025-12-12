/**
 * Shop modal component
 * 상점 모달 컴포넌트
 */

'use client';

import { useState } from 'react';
import { trpc } from '../../lib/trpc/utils';

interface ShopModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShopModal({ isOpen, onClose }: ShopModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<'item' | 'equipment' | 'consumable'>('item');
  
  const { data: shopItems, refetch } = trpc.shop.getItems.useQuery(
    { category: selectedCategory },
    { enabled: isOpen }
  );
  const { data: user } = trpc.user.me.useQuery(undefined, { enabled: isOpen });

  const purchaseMutation = trpc.shop.purchase.useMutation({
    onSuccess: () => {
      refetch();
      // Refetch user to update gold/diamonds
      trpc.user.me.useQuery().refetch();
    },
  });

  if (!isOpen) return null;

  const handlePurchase = (itemId: string, price: number, currency: 'gold' | 'diamonds') => {
    if (!user) return;
    
    if (currency === 'gold' && user.gold < price) {
      alert('골드가 부족합니다.');
      return;
    }
    
    if (currency === 'diamonds' && user.diamonds < price) {
      alert('다이아가 부족합니다.');
      return;
    }

    if (confirm(`이 아이템을 구매하시겠습니까? (${price} ${currency === 'gold' ? '골드' : '다이아'})`)) {
      purchaseMutation.mutate({ itemId });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">상점</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          {/* User currency display */}
          {user && (
            <div className="flex gap-4 mb-4 p-3 bg-gray-50 rounded">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">골드:</span>
                <span className="text-lg font-bold text-yellow-600">{user.gold}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">다이아:</span>
                <span className="text-lg font-bold text-blue-600">{user.diamonds}</span>
              </div>
            </div>
          )}

          {/* Category tabs */}
          <div className="flex gap-2 mb-4 border-b">
            <button
              onClick={() => setSelectedCategory('item')}
              className={`px-4 py-2 font-medium ${
                selectedCategory === 'item'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              아이템
            </button>
            <button
              onClick={() => setSelectedCategory('equipment')}
              className={`px-4 py-2 font-medium ${
                selectedCategory === 'equipment'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              장비
            </button>
            <button
              onClick={() => setSelectedCategory('consumable')}
              className={`px-4 py-2 font-medium ${
                selectedCategory === 'consumable'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              소모품
            </button>
          </div>

          {/* Items grid */}
          {shopItems && shopItems.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {shopItems.map((item) => (
                <div
                  key={item.id}
                  className="border border-gray-200 rounded p-4 hover:shadow-md transition-shadow"
                >
                  <div className="text-sm font-medium mb-2">{item.name}</div>
                  <div className="text-xs text-gray-600 mb-2">{item.description}</div>
                  <div className="flex items-center justify-between mb-3">
                    {item.priceGold && (
                      <span className="text-sm font-semibold text-yellow-600">
                        {item.priceGold} 골드
                      </span>
                    )}
                    {item.priceDiamonds && (
                      <span className="text-sm font-semibold text-blue-600">
                        {item.priceDiamonds} 다이아
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      const price = item.priceGold || item.priceDiamonds || 0;
                      const currency = item.priceGold ? 'gold' : 'diamonds';
                      handlePurchase(item.id, price, currency);
                    }}
                    disabled={purchaseMutation.isPending}
                    className="w-full text-xs bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    구매
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">
              {selectedCategory === 'item' ? '아이템' :
               selectedCategory === 'equipment' ? '장비' :
               '소모품'}이 없습니다.
            </p>
          )}

          {purchaseMutation.error && (
            <div className="mt-4 p-3 bg-red-50 text-red-600 rounded text-sm">
              {purchaseMutation.error.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

