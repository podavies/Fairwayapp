Pod::Spec.new do |s|
  s.name           = 'ScorecardOcr'
  s.version        = '1.0.0'
  s.summary        = 'On-device OCR for scorecard photos'
  s.description    = 'Missfits Rollup Golf Calculator local iPhone OCR support for reading golf scorecard images.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
