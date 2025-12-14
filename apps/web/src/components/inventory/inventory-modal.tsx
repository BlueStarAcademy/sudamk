/**
 * Inventory modal component
 * 인벤토리 모달 컴포넌트
 */

'use client';

import { useState } from 'react';
import { trpc } from '../../lib/trpc/utils';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InventoryModal({ isOpen, onClose }: InventoryModalProps) {
  const { data: inventory, refetch } = trpc.inventory.getMyInventory.useQuery(
    undefined,
    { enabled: isOpen }
  );
  const { data: equipment } = trpc.inventory.getMyEquipment.useQuery(
    undefined,
    { enabled: isOpen }
  );

  const equipMutation = trpc.inventory.equip.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const unequipMutation = trpc.inventory.unequip.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  if (!isOpen) return null;

  const equipmentMap = new Map(
    equipment?.map((eq) => [eq.slot, eq.inventory]) || []
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">인벤토리</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Equipment slots */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">착용 중인 장비</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['weapon', 'armor', 'accessory1', 'accessory2'].map((slot) => {
                const equipped = equipmentMap.get(slot) as any;
                return (
                  <div
                    key={slot}
                    className="border border-gray-200 rounded p-3 text-center"
                  >
                    <div className="text-sm text-gray-600 mb-2">
                      {slot === 'weapon' ? '무기' :
                       slot === 'armor' ? '방어구' :
                       slot === 'accessory1' ? '장신구 1' :
                       '장신구 2'}
                    </div>
                    {equipped ? (
                      <div>
                        <div className="text-sm font-medium">
                          {equipped?.templateId || 'N/A'}
                        </div>
                        <button
                          onClick={() => {
                            unequipMutation.mutate({ slot });
                          }}
                          className="mt-2 text-xs text-red-600 hover:text-red-700"
                        >
                          해제
                        </button>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400">비어있음</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Inventory items */}
          <div>
            <h3 className="text-lg font-semibold mb-3">아이템 목록</h3>
            {inventory && inventory.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {inventory.map((item) => (
                  <div
                    key={item.id}
                    className="border border-gray-200 rounded p-3 hover:shadow-md transition-shadow"
                  >
                    <div className="text-sm font-medium mb-1">
                      {item.templateId}
                    </div>
                    <div className="text-xs text-gray-600 mb-2">
                      수량: {item.quantity}
                    </div>
                    {item.slot && !item.isEquipped && (
                      <button
                        onClick={() => {
                          equipMutation.mutate({
                            inventoryId: item.id,
                            slot: item.slot,
                          });
                        }}
                        className="w-full text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                      >
                        착용
                      </button>
                    )}
                    {item.isEquipped && (
                      <div className="text-xs text-green-600">착용 중</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">
                인벤토리가 비어있습니다.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

