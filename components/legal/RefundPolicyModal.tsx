import React from 'react';
import LegalDocumentModal, { type LegalSection } from './LegalDocumentModal.js';
import { COMPANY_INFO } from './companyInfo.js';

const SECTIONS: LegalSection[] = [
    {
        title: '청약철회의 효력',
        paragraphs: [
            '회원은 「전자상거래 등에서의 소비자보호에 관한 법률」(이하 "전자상거래법")에 따라 결제일 또는 유료 콘텐츠 이용 가능일로부터 7일 이내에 청약철회를 할 수 있습니다.',
            '청약철회 의사 표시가 회사에 도달한 때에 그 효력이 발생합니다.',
        ],
    },
    {
        title: '청약철회가 제한되는 경우',
        paragraphs: [
            '아래의 경우에는 회원의 청약철회 권리가 제한될 수 있습니다.',
        ],
        bullets: [
            '회원이 결제 후 유료 콘텐츠(다이아, 골드, VIP 멤버십 등)를 이미 사용·소비한 경우',
            '결제 직후 즉시 효력이 발생하여 회원에게 효용이 제공된 경우(예: VIP 멤버십 즉시 적용분)',
            '회원의 귀책사유로 콘텐츠가 멸실 또는 훼손된 경우',
            '시간 경과에 의하여 재판매가 곤란한 경우',
            '시즌·기간 한정 패키지를 사용 또는 우편으로 일부 수령한 경우 잔여분에 한하여 가능',
        ],
    },
    {
        title: '환불 절차',
        paragraphs: [
            '환불을 원하시는 회원은 아래 절차에 따라 신청해 주시기 바랍니다.',
        ],
        bullets: [
            `1. 고객센터 이메일(${COMPANY_INFO.email})로 환불 신청서 송부`,
            '2. 필수 기재 사항: 계정 이메일·결제일·결제수단·결제 금액·환불 사유',
            '3. 회사 확인 후 영업일 기준 3일 이내 환불 가능 여부 회신',
            '4. 환불 결정 시 결제수단별로 영업일 기준 3~5일 내 환불 처리',
        ],
    },
    {
        title: '결제 수단별 환불 방법',
        bullets: [
            '신용카드: 결제 취소를 통해 카드사에 즉시 통보(카드사 정책에 따라 입금까지 3~7영업일 소요)',
            '계좌이체: 회원이 지정한 계좌로 환불금 송금',
            '간편결제(카카오페이 등): 결제 수단의 원천(카드/계좌)으로 환불',
            '정기결제(구독): 다음 결제 예정일 이전에 해지 시 추가 결제가 발생하지 않음',
        ],
    },
    {
        title: '정기결제(VIP 멤버십) 해지 안내',
        paragraphs: [
            'VIP 멤버십 등 정기결제 상품은 회원이 직접 해지하지 않는 한 결제 주기마다 자동 갱신됩니다.',
        ],
        bullets: [
            '서비스 내 마이페이지 또는 상점의 "구독 관리" 메뉴에서 언제든지 해지 가능',
            `해지가 어려운 경우 고객센터 이메일(${COMPANY_INFO.email}) 또는 전화(${COMPANY_INFO.phone})로 요청`,
            '해지 신청은 다음 결제 예정일 24시간 전까지 완료되어야 다음 결제가 청구되지 않습니다',
            '해지 후에도 이미 결제된 기간 동안은 VIP 혜택이 유지됩니다',
        ],
    },
    {
        title: '미성년자 결제 보호',
        paragraphs: [
            '만 19세 미만 미성년자가 법정대리인의 동의 없이 결제한 경우, 본인 또는 법정대리인은 결제 취소를 요청할 수 있습니다.',
            '본인 확인 및 미성년자 결제 사실 확인을 위해 가족관계증명서 등 증빙 자료가 요청될 수 있습니다.',
        ],
    },
    {
        title: '결제 분쟁 처리',
        paragraphs: [
            '회사와 회원 간에 발생한 결제·환불 관련 분쟁은 우선적으로 상호 협의를 통해 해결합니다.',
            '협의가 이루어지지 않을 경우 공정거래위원회 또는 한국소비자원의 분쟁 조정을 신청할 수 있습니다.',
        ],
        bullets: [
            '한국소비자원: 1372 (kca.go.kr)',
            '공정거래위원회: 1670-0007 (ftc.go.kr)',
            '전자거래분쟁조정위원회: (ecmc.or.kr)',
        ],
    },
    {
        title: '환불 문의',
        paragraphs: [
            '환불 및 결제 관련 문의는 아래 고객센터로 연락해 주시기 바랍니다. 운영일 기준 24시간 이내에 답변드리고자 노력하고 있습니다.',
        ],
        bullets: [
            `이메일: ${COMPANY_INFO.email}`,
            `전화: ${COMPANY_INFO.phone}`,
            `상호: ${COMPANY_INFO.name} (대표 ${COMPANY_INFO.representative})`,
            `사업자등록번호: ${COMPANY_INFO.businessNumber}`,
            `통신판매업신고: ${COMPANY_INFO.mailOrderNumber}`,
        ],
    },
];

interface Props {
    onClose: () => void;
    isTopmost?: boolean;
}

const RefundPolicyModal: React.FC<Props> = ({ onClose, isTopmost }) => (
    <LegalDocumentModal
        title="취소·환불 규정"
        eyebrow="Refund Policy"
        intro="유료 콘텐츠의 청약철회 및 환불에 관한 사항을 안내드립니다. 본 규정은 전자상거래법 등 관계 법령에 따라 작성되었습니다."
        sections={SECTIONS}
        onClose={onClose}
        isTopmost={isTopmost}
    />
);

export default RefundPolicyModal;
