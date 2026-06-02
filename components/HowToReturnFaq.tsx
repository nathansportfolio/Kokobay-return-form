import { CaretDown } from "@phosphor-icons/react";

const BODY_CLASS = "text-[0.9375rem] leading-relaxed text-zinc-600 dark:text-zinc-300";

const FAQ_LINK_CLASS =
  "font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200";

export const HOW_TO_RETURN_FAQ_LINKS = {
  email: "info@kokobay.co.uk",
  contactUs: "https://www.kokobay.co.uk/pages/contact-us",
  returnsPortal: "https://www.kokobay-returns.co.uk/",
  deliveryInformation: "https://www.kokobay.co.uk/pages/delivery-information",
  postcodeExclusions: "https://www.kokobay.co.uk/pages/postcode-exclusions",
  collaborations: "https://www.kokobay.co.uk/pages/kokobae",
  instagram: "https://www.instagram.com/kokobayuk",
} as const;

function FaqEmailLink() {
  return (
    <a href={`mailto:${HOW_TO_RETURN_FAQ_LINKS.email}`} className={FAQ_LINK_CLASS}>
      {HOW_TO_RETURN_FAQ_LINKS.email}
    </a>
  );
}

function FaqContactLink({ children = "contact us" }: { children?: React.ReactNode }) {
  return (
    <a
      href={HOW_TO_RETURN_FAQ_LINKS.contactUs}
      className={FAQ_LINK_CLASS}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}

function FaqItem({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <details className="group border-b border-zinc-200/80 dark:border-zinc-800">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-4 text-left text-sm font-medium tracking-normal text-zinc-900 sm:text-[0.9375rem] dark:text-zinc-50 [&::-webkit-details-marker]:hidden">
        <span>{question}</span>
        <CaretDown
          className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 group-open:rotate-180 dark:text-zinc-400"
          aria-hidden
        />
      </summary>
      <div className={`space-y-3 pb-5 pr-1 sm:pr-4 ${BODY_CLASS}`}>{children}</div>
    </details>
  );
}

function FaqCategory({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`faq-${title.replace(/\s+/g, "-").toLowerCase()}`}>
      <h3
        id={`faq-${title.replace(/\s+/g, "-").toLowerCase()}`}
        className="border-b border-zinc-200/80 pb-3 text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
      >
        {title}
      </h3>
      <div className="mt-1">{children}</div>
    </section>
  );
}

export function HowToReturnFaq() {
  return (
    <section
      aria-labelledby="need-help-heading"
      className="mt-20 border-t border-zinc-200/90 pt-14 sm:mt-24 sm:pt-16 dark:border-zinc-800"
    >
      <header className="space-y-3">
        <h2
          id="need-help-heading"
          className="text-xl font-medium tracking-normal text-zinc-900 sm:text-2xl dark:text-zinc-50"
        >
          Need help?
        </h2>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          Frequently Asked Questions
        </p>
      </header>

      <div className="mt-10 space-y-12 sm:mt-12 sm:space-y-14">
        <FaqCategory title="Orders">
          <FaqItem question="I've placed an order but had no email confirmation yet money has left my bank?">
            <p>
              Not to worry, it may just be the case that the email has gone into your junk
              folder, so please check there. If you still can&apos;t find it, email us (
              <FaqEmailLink />
              ) with the full name you used to place your order we can check it from our end
              and issue you with an order number, and resend your tracking code if it has
              already been dispatched.
            </p>
            <p>
              Please double check your email is correctly spelt when entering it at checkout
              as this may also be the cause.
            </p>
          </FaqItem>

          <FaqItem question="How do I know you have received my order?">
            <p>
              Once you&apos;ve placed your order, you will land on a confirmation page which
              will contain your order number. This info will also be emailed to you (please
              note this can take up to 30 minutes to arrive in your inbox.) Once your order
              has been processed by our team and dispatched you will receive a 2nd email with
              the tracking to let you know that your order is on its way to you.
            </p>
          </FaqItem>

          <FaqItem question="I entered the wrong address/wrong size when placing an order, can I change it?">
            <p>
              Please contact us ASAP by email (<FaqEmailLink />) and tell us your order
              number, name and the issue and we will do our best to help provided the order
              has not already been dispatched.
            </p>
            <p>
              Unfortunately if this is not done instantly we can&apos;t change it as orders
              are processed straight away.
            </p>
            <p>Please note: we cannot guarantee modifications before dispatch.</p>
          </FaqItem>

          <FaqItem question="How do I track my order?">
            <p>
              Once you have placed an order you will shortly receive a confirmation email
              containing the tracking code.
            </p>
            <p>
              To ensure that this goes into your inbox please add <FaqEmailLink /> to your
              contacts, otherwise your confirmation email may end up in your junk/spam folder.
              If you still have not received your order confirmation email please{" "}
              <FaqContactLink />.
            </p>
          </FaqItem>

          <FaqItem question="What should I do if I recieve an incorrect/faulty item?">
            <p>
              We&apos;re sorry to hear that you&apos;ve received an incorrect or faulty item.
              So we can get this sorted for you, please drop us a message with the following
              info:
            </p>
            <ul className="list-disc space-y-1 pl-5" role="list">
              <li>Your name</li>
              <li>Your order number</li>
              <li>Product name (this can be found on your order confirmation email)</li>
              <li>Picture of the fault / incorrect item</li>
            </ul>
          </FaqItem>
        </FaqCategory>

        <FaqCategory title="delivery">
          <FaqItem question="Do you ship worldwide?">
            <p>
              Yes! Our international delivery varies in price from country to country, please
              select your country at checkout for accurate prices.
            </p>
            <p>
              More info can be found on our{" "}
              <a
                href={HOW_TO_RETURN_FAQ_LINKS.deliveryInformation}
                className={FAQ_LINK_CLASS}
                target="_blank"
                rel="noopener noreferrer"
              >
                Shipping &amp; Returns page
              </a>
              .
            </p>
          </FaqItem>

          <FaqItem question="How long will my item take to get to me?">
            <p className="font-medium text-zinc-800 dark:text-zinc-200">UK:</p>
            <ul className="list-disc space-y-2 pl-5" role="list">
              <li>
                Standard shipping (£2.99) - 3-5 working days. Orders do not get dispatched on
                weekends, only Monday-Friday, however still get delivered on Saturdays.
              </li>
              <li>
                Express shipping (£3.99) - 1-3 working days. Order before 12pm for same day
                dispatch. Orders after 12pm will be dispatched the next working day. Orders do
                not get delivered/dispatched on weekends.
              </li>
              <li>
                Evri next day delivery (£5.99) - order before 12pm for same day dispatch.
                Anything ordered after 12pm will be dispatched the following day. Please note
                anything ordered after 12pm Friday will be dispatched the following Monday (or
                Tuesday if it is bank holiday).
              </li>
              <li>
                Royal Mail next day delivery (£7.99) - order before 3pm for same day dispatch.
              </li>
            </ul>
            <p className="font-medium text-zinc-800 dark:text-zinc-200">Rest of the world:</p>
            <p>
              Standard shipping (price dependant on destination) - delivery aim 8-15 working
              days. Please note however that once the parcel has left the UK we can no longer
              be responsible for it.
            </p>
            <p>We ship using Evri and Royal Mail.</p>
          </FaqItem>

          <FaqItem question="Next day delivery / express delivery - postcode exclusions">
            <p>Please note the following restrictions apply:</p>
            <p>
              We cannot offer Next Day delivery to the Scottish Islands, Scottish Highlands,
              Channel Isles, Isle of Man, Isle of Wight, Scilly Isles, Cornwall, Jersey,
              Guernsey, Kilmarnock and Perth areas and certain areas in England.
            </p>
            <p>
              You can find our full list of postcode exclusions{" "}
              <a
                href={HOW_TO_RETURN_FAQ_LINKS.postcodeExclusions}
                className={FAQ_LINK_CLASS}
                target="_blank"
                rel="noopener noreferrer"
              >
                here
              </a>
              .
            </p>
            <p>
              Please note it is your responsibility to order with the correct shipping service
              and we will not be liable for late deliveries on postcode exclusions.
            </p>
          </FaqItem>

          <FaqItem question="I can't see next day delivery at checkout?">
            <p>
              During busy periods or sale periods Next Day delivery may not be available.
            </p>
          </FaqItem>

          <FaqItem question="Do I need to pay customs charges for international orders?">
            <p>
              Depending on the value of your order, your parcel may or may not be charged
              customs or import duties. If your parcel is charged, it is up to the person
              receiving the parcel to cover these costs. Unfortunately, these charges are out
              of our hands, and vary widely from country to country, so we&apos;re unable to
              predict what your particular charges may be. For more accurate information, we
              would suggest getting in touch with your local customs office so you&apos;re not
              surprised if there are any unexpected delivery charges at your end.
            </p>
          </FaqItem>
        </FaqCategory>

        <FaqCategory title="returns">
          <FaqItem question="How do I return an item?">
            <p>
              Fill in the form for each item you are returning, along with your name, email,
              order number and date posted back. This can either be done by printing the form
              out, or writing it out if you don&apos;t have access to a printer.
            </p>
            <p>
              Re-pack the item in the bag with labels and tags still attached (you can reuse
              our bags to be more environmentally friendly).
            </p>
            <p>
              We advise you to use a tracked service to return any parcels and obtain proof
              of postage as we will not be held liable for missing parcels.
            </p>
            <p>
              A refund will be issued for items returned to us in a resaleable condition. If
              discounts were applied the refund value will reflect the discounts used.
            </p>
            <p>
              <a
                href={HOW_TO_RETURN_FAQ_LINKS.returnsPortal}
                className={FAQ_LINK_CLASS}
                target="_blank"
                rel="noopener noreferrer"
              >
                Click here for the returns sheet.
              </a>
            </p>
          </FaqItem>

          <FaqItem question="Where can I find your returns form?">
            <p>
              You can find our returns form{" "}
              <a
                href={HOW_TO_RETURN_FAQ_LINKS.returnsPortal}
                className={FAQ_LINK_CLASS}
                target="_blank"
                rel="noopener noreferrer"
              >
                here
              </a>
              .
            </p>
          </FaqItem>

          <FaqItem question="I've sent my item back but have not heard anything back yet?">
            <p>
              Returns can take up to 14 working days to process. Please note that this does
              not include weekends or bank holidays.
            </p>
            <p>
              Please note we do NOT send email confirmations to say your return has reached
              us; you will only receive one to say your refund has been processed at the time
              of processing. Please do not email to ask us if we have received your return as
              this will slow down the process of you receiving your refund.
            </p>
            <p>
              If it has been over 14 working day since your item was received by us then
              please <FaqContactLink /> via email.
            </p>
          </FaqItem>

          <FaqItem question="Do I have to pay postage to return an item?">
            <p>
              Due to us being a small business we can&apos;t yet offer free returns, so at
              present you as a customer have to cover return postage.
            </p>
          </FaqItem>
        </FaqCategory>

        <FaqCategory title="product & stock">
          <FaqItem question="When is your next restock?">
            <p>
              Any new drops and restock dates will be announced on our Instagram page{" "}
              <a
                href={HOW_TO_RETURN_FAQ_LINKS.instagram}
                className={FAQ_LINK_CLASS}
                target="_blank"
                rel="noopener noreferrer"
              >
                @kokobayuk
              </a>
              .
            </p>
            <p>
              In the meantime, we recommend signing up for restock notifications so that you
              get notified once the item comes back in stock as sizes may appear as we process
              returns. You can do this by going onto the specific product page, clicking the
              size you want and then clicking &ldquo;notify when available&rdquo;.and filling
              out the relevant information.
            </p>
          </FaqItem>

          <FaqItem question="How do back in stock notifications work?">
            <p>
              On the right hand side of every product page which contains an out of stock size,
              you will see a black bar which says &apos;notify when available&apos;.
            </p>
            <p>
              Select the size you are after, click &apos;notify when available&apos; and fill
              out you email/number.
            </p>
            <p>
              When that product/sizes comes back into stock, you wll recieve an email/SMS
              message informing you that it&apos;s back with a link to click through to the
              selected product.
            </p>
          </FaqItem>

          <FaqItem question="How often do you launch new products?">
            <p>We aim to launch new products every week/every couple of weeks!</p>
            <p>
              As a small business we tend to do more regular small drops, rather than one big
              drop - you can keep up to date with this on our instagram page where we share
              upcoming drops!
            </p>
          </FaqItem>
        </FaqCategory>

        <FaqCategory title="promotions & discounts">
          <FaqItem question="Is there a discount code I can use for my first order?">
            <p>Yes, you can sign up to our mailing list for 15% off your first order!</p>
          </FaqItem>

          <FaqItem question="I want to collab with you guys - how do I get in touch?">
            <p>
              We&apos;re constantly looking for new people to collaborate with. Please check
              our our{" "}
              <a
                href={HOW_TO_RETURN_FAQ_LINKS.collaborations}
                className={FAQ_LINK_CLASS}
                target="_blank"
                rel="noopener noreferrer"
              >
                collaborations page
              </a>{" "}
              for more info on how to do this.
            </p>
          </FaqItem>
        </FaqCategory>
      </div>
    </section>
  );
}
