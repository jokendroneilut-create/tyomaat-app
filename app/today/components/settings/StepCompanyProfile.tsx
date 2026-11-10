"use client"

import { companyProfiles } from "./todaySettingsConfig"

type StepCompanyProfileProps = {
  selectedProfile: string | null
  onChange: (profile: string) => void
}

export default function StepCompanyProfile({
  selectedProfile,
  onChange,
}: StepCompanyProfileProps) {
  return (
    <div>
      <h3 className="text-xl font-bold text-gray-900">
        Mikä kuvaa yritystäsi parhaiten?
      </h3>

      <p className="mt-2 text-gray-600">
        Valintaa voidaan myöhemmin käyttää suositeltujen asetusten pohjana.
      </p>

      {/* Kolme saraketta: 13 vaihtoehtoa kahdessa on seitseman rivia eika mahdu ilman vieritysta. */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {companyProfiles.map((profile) => (
          <button
            key={profile}
            type="button"
            onClick={() => onChange(profile)}
            className={`rounded-lg border px-3 py-2.5 text-left text-sm font-semibold ${
              selectedProfile === profile
                ? "border-gray-900 bg-gray-900 text-white"
                : "hover:bg-gray-50"
            }`}
          >
            {profile}
          </button>
        ))}
      </div>
    </div>
  )
}