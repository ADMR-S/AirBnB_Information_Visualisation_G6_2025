build/cb_2020_us_county_20m.zip:
	mkdir -p $(dir $@)
	curl --fail -o build/cb_2020_us_county_20m.zip https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_county_20m.zip
build/cb_2020_us_county_20m.shp: build/cb_2020_us_county_20m.zip
	unzip -od $(dir $@) $<
	touch $@
build/counties.json: build/cb_2020_us_county_20m.shp
	node preprocess.js
