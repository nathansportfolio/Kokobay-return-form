/** Shared copy and links for /how-to-return (Next.js page + Shopify export). */

export const RETURNS_HOME_URL = "https://www.kokobay-returns.co.uk/";

export const HOW_TO_RETURN_LINKS = {
  /** Returns form portal (home page) */
  startReturn: RETURNS_HOME_URL,
  returnsPortal: RETURNS_HOME_URL,
  email: "info@kokobay.co.uk",
  contactUs: "https://www.kokobay.co.uk/pages/contact-us",
  deliveryInformation: "https://www.kokobay.co.uk/pages/delivery-information",
  postcodeExclusions: "https://www.kokobay.co.uk/pages/postcode-exclusions",
  collaborations: "https://www.kokobay.co.uk/pages/kokobae",
  instagram: "https://www.instagram.com/kokobayuk",
} as const;

export const RETURNS_ADDRESS = `KOKOBAY RETURNS
UNITS 8 & 9 ATLANTIC BUSINESS CENTRE
ATLANTIC STREET
ALTRINCHAM
WA14 5NQ`;

export const RETURN_POLICY_PARAGRAPHS = [
  "We operate a 14 day returns period. All eligible items must be returned within 14 days of receipt. Unfortunately if it has been over 14 days we are unable to accept your return and it will be rejected and returned back to you.",
  "The returns form can be found below. You can either print this out, or write it out if you don't have access to a printer.",
  "Please ensure the returns form is filled out and included in your return. Items sent back without any relevant info means we don't know who the return is coming from, and can therefore can increase time taken for us to process your return.",
  "Returned items are your responsibility until they reach us, so make sure they're packed up securely and can't get damaged on the way! Please return your item using a signed for or tracked service as we are not responsible for your parcel getting lost en route to us. Please keep your proof of postage until you receive your refund.",
  "For customers within the United Kingdom, returns can now be sent using our InPost returns service for added convenience. Please note that a £3.99 returns fee will be deducted from your refund total when using this service.",
  "Customers outside of the United Kingdom will need to arrange and pay for return postage themselves using a tracked or signed-for service, as we currently do not provide international return labels.",
  "We're not responsible for any items that are returned to us by mistake. If we're able to locate them (which is not always possible) and you'd like these returned to you, we may ask you to cover the delivery cost.",
  "Once we receive your return it can take up to 14 working days to action. During the processing time please do not contact us as this can delay your return. Sending multiple messages may inadvertently delay our response time by moving your message in the queue as we reply to emails in a chronological order.",
  "Please remember that we do NOT send email confirmations to say your return has reached us; you will only receive one to say your refund has been processed at the time of processing. Please do not email to ask us if we have received your return as this will slow down the process of you receiving your refund.",
  "Our business hours are from 9-5PM GMT, Monday to Friday and we aim to reply to all customer queries within 48 hours during these hours.",
  "Once we have actioned the return you will then receive a notification via email that your return has been processed.",
  "Due to us being a small business we can't yet offer free returns, so at present you as a customer have to cover return postage. Please note your initial postage is non-refundable.",
  "Please note, if the value of your return exdceeds £300 you will be charged a 5% handing fee. This will be deducted from your total refund amount.",
  "We will gladly accept a return of, unworn, unwashed, unmarked, unaltered, and undamaged merchandise from UK customers only. We only currently accept returns from within the United Kingdom due to customs charges.",
  "Please take care when trying on your new items, any damage such as (but not limited to): makeup stains / washed items / deodorant / perfume / pet hairs / stains / spills / discolouration / tampered tags / general wear and tear will be refused, and your order will be sent back to you.",
  "If swimwear is sent back marked or dirty, it will be immediately refused and returned back to you. Please keep underwear on when trying swimwear.",
  "We reserve the right to refuse and return if items are not returned in a saleable condition or are damaged, or we believe they have been tampered with.",
  "We cannot accept returns for any jewellery, accessories e.g hats & caps, or underwear, due to hygiene reasons.",
] as const;

export type FaqEntry = { question: string; answerHtml: string };

export type FaqCategory = { title: string; items: FaqEntry[] };

function mailto(email: string): string {
  return `<a class="kb-link" href="mailto:${email}">${email}</a>`;
}

function extLink(href: string, label: string): string {
  return `<a class="kb-link" href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

export function buildFaqCategories(links: typeof HOW_TO_RETURN_LINKS): FaqCategory[] {
  const email = mailto(links.email);
  const contact = extLink(links.contactUs, "contact us");

  return [
    {
      title: "Orders",
      items: [
        {
          question:
            "I've placed an order but had no email confirmation yet money has left my bank?",
          answerHtml: `<p>Not to worry, it may just be the case that the email has gone into your junk folder, so please check there. If you still can't find it, email us (${email}) with the full name you used to place your order we can check it from our end and issue you with an order number, and resend your tracking code if it has already been dispatched.</p><p>Please double check your email is correctly spelt when entering it at checkout as this may also be the cause.</p>`,
        },
        {
          question: "How do I know you have received my order?",
          answerHtml: `<p>Once you've placed your order, you will land on a confirmation page which will contain your order number. This info will also be emailed to you (please note this can take up to 30 minutes to arrive in your inbox.) Once your order has been processed by our team and dispatched you will receive a 2nd email with the tracking to let you know that your order is on its way to you.</p>`,
        },
        {
          question:
            "I entered the wrong address/wrong size when placing an order, can I change it?",
          answerHtml: `<p>Please contact us ASAP by email (${email}) and tell us your order number, name and the issue and we will do our best to help provided the order has not already been dispatched.</p><p>Unfortunately if this is not done instantly we can't change it as orders are processed straight away.</p><p>Please note: we cannot guarantee modifications before dispatch.</p>`,
        },
        {
          question: "How do I track my order?",
          answerHtml: `<p>Once you have placed an order you will shortly receive a confirmation email containing the tracking code.</p><p>To ensure that this goes into your inbox please add ${email} to your contacts, otherwise your confirmation email may end up in your junk/spam folder. If you still have not received your order confirmation email please ${contact}.</p>`,
        },
        {
          question: "What should I do if I recieve an incorrect/faulty item?",
          answerHtml: `<p>We're sorry to hear that you've received an incorrect or faulty item. So we can get this sorted for you, please drop us a message with the following info:</p><ul><li>Your name</li><li>Your order number</li><li>Product name (this can be found on your order confirmation email)</li><li>Picture of the fault / incorrect item</li></ul>`,
        },
      ],
    },
    {
      title: "delivery",
      items: [
        {
          question: "Do you ship worldwide?",
          answerHtml: `<p>Yes! Our international delivery varies in price from country to country, please select your country at checkout for accurate prices.</p><p>More info can be found on our ${extLink(links.deliveryInformation, "Shipping &amp; Returns page")}.</p>`,
        },
        {
          question: "How long will my item take to get to me?",
          answerHtml: `<p class="kb-strong">UK:</p><ul><li>Standard shipping (£2.99) - 3-5 working days. Orders do not get dispatched on weekends, only Monday-Friday, however still get delivered on Saturdays.</li><li>Express shipping (£3.99) - 1-3 working days. Order before 12pm for same day dispatch. Orders after 12pm will be dispatched the next working day. Orders do not get delivered/dispatched on weekends.</li><li>Evri next day delivery (£5.99) - order before 12pm for same day dispatch. Anything ordered after 12pm will be dispatched the following day. Please note anything ordered after 12pm Friday will be dispatched the following Monday (or Tuesday if it is bank holiday).</li><li>Royal Mail next day delivery (£7.99) - order before 3pm for same day dispatch.</li></ul><p class="kb-strong">Rest of the world:</p><p>Standard shipping (price dependant on destination) - delivery aim 8-15 working days. Please note however that once the parcel has left the UK we can no longer be responsible for it.</p><p>We ship using Evri and Royal Mail.</p>`,
        },
        {
          question: "Next day delivery / express delivery - postcode exclusions",
          answerHtml: `<p>Please note the following restrictions apply:</p><p>We cannot offer Next Day delivery to the Scottish Islands, Scottish Highlands, Channel Isles, Isle of Man, Isle of Wight, Scilly Isles, Cornwall, Jersey, Guernsey, Kilmarnock and Perth areas and certain areas in England.</p><p>You can find our full list of postcode exclusions ${extLink(links.postcodeExclusions, "here")}.</p><p>Please note it is your responsibility to order with the correct shipping service and we will not be liable for late deliveries on postcode exclusions.</p>`,
        },
        {
          question: "I can't see next day delivery at checkout?",
          answerHtml: `<p>During busy periods or sale periods Next Day delivery may not be available.</p>`,
        },
        {
          question: "Do I need to pay customs charges for international orders?",
          answerHtml: `<p>Depending on the value of your order, your parcel may or may not be charged customs or import duties. If your parcel is charged, it is up to the person receiving the parcel to cover these costs. Unfortunately, these charges are out of our hands, and vary widely from country to country, so we're unable to predict what your particular charges may be. For more accurate information, we would suggest getting in touch with your local customs office so you're not surprised if there are any unexpected delivery charges at your end.</p>`,
        },
      ],
    },
    {
      title: "returns",
      items: [
        {
          question: "How do I return an item?",
          answerHtml: `<p>Fill in the form for each item you are returning, along with your name, email, order number and date posted back. This can either be done by printing the form out, or writing it out if you don't have access to a printer.</p><p>Re-pack the item in the bag with labels and tags still attached (you can reuse our bags to be more environmentally friendly).</p><p>We advise you to use a tracked service to return any parcels and obtain proof of postage as we will not be held liable for missing parcels.</p><p>A refund will be issued for items returned to us in a resaleable condition. If discounts were applied the refund value will reflect the discounts used.</p><p>${extLink(links.returnsPortal, "Click here for the returns sheet.")}</p>`,
        },
        {
          question: "Where can I find your returns form?",
          answerHtml: `<p>You can find our returns form ${extLink(links.returnsPortal, "here")}.</p>`,
        },
        {
          question: "I've sent my item back but have not heard anything back yet?",
          answerHtml: `<p>Returns can take up to 14 working days to process. Please note that this does not include weekends or bank holidays.</p><p>Please note we do NOT send email confirmations to say your return has reached us; you will only receive one to say your refund has been processed at the time of processing. Please do not email to ask us if we have received your return as this will slow down the process of you receiving your refund.</p><p>If it has been over 14 working day since your item was received by us then please ${contact} via email.</p>`,
        },
        {
          question: "Do I have to pay postage to return an item?",
          answerHtml: `<p>Due to us being a small business we can't yet offer free returns, so at present you as a customer have to cover return postage.</p>`,
        },
      ],
    },
    {
      title: "product & stock",
      items: [
        {
          question: "When is your next restock?",
          answerHtml: `<p>Any new drops and restock dates will be announced on our Instagram page ${extLink(links.instagram, "@kokobayuk")}.</p><p>In the meantime, we recommend signing up for restock notifications so that you get notified once the item comes back in stock as sizes may appear as we process returns. You can do this by going onto the specific product page, clicking the size you want and then clicking “notify when available”.and filling out the relevant information.</p>`,
        },
        {
          question: "How do back in stock notifications work?",
          answerHtml: `<p>On the right hand side of every product page which contains an out of stock size, you will see a black bar which says 'notify when available'.</p><p>Select the size you are after, click 'notify when available' and fill out you email/number.</p><p>When that product/sizes comes back into stock, you wll recieve an email/SMS message informing you that it's back with a link to click through to the selected product.</p>`,
        },
        {
          question: "How often do you launch new products?",
          answerHtml: `<p>We aim to launch new products every week/every couple of weeks!</p><p>As a small business we tend to do more regular small drops, rather than one big drop - you can keep up to date with this on our instagram page where we share upcoming drops!</p>`,
        },
      ],
    },
    {
      title: "promotions & discounts",
      items: [
        {
          question: "Is there a discount code I can use for my first order?",
          answerHtml: `<p>Yes, you can sign up to our mailing list for 15% off your first order!</p>`,
        },
        {
          question: "I want to collab with you guys - how do I get in touch?",
          answerHtml: `<p>We're constantly looking for new people to collaborate with. Please check our our ${extLink(links.collaborations, "collaborations page")} for more info on how to do this.</p>`,
        },
      ],
    },
  ];
}

export const UK_RETURN_STEPS = [
  "Enter your order number and the email address used on the order, then select the item(s) you wish to return.",
  "Pack your return securely in suitable packaging (use original packaging and keep tags attached where possible) before you drop off.",
  'After submitting the form, press the <strong>InPost Returns</strong> button to find your nearest InPost Locker or Shop.',
  "InPost will then email you a QR code to use at the locker — no printing required.",
  "Once your parcel has been received and is being processed, we'll send you an email update.",
] as const;

export const OUTSIDE_UK_RETURN_STEPS = [
  "Enter your order number, the email on the order, and load your items.",
  "Tick the items you are returning. You must choose a return reason for each selected item.",
  'Put the <strong>original A4 paper</strong> from your delivery inside the parcel with your items. If you no longer have it, <strong>write your order number clearly on a slip of paper</strong> and place that inside the parcel instead.',
  "Submit the form, then post your return to the address below (use a tracked or signed-for service and keep your proof of postage).",
  "We will email you once your return is being processed.",
] as const;
