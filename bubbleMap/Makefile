build/cb_2020_us_county_20m.zip:
	mkdir -p $(dir $@)
	curl --fail -o build/cb_2020_us_county_20m.zip https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_county_20m.zip
build/cb_2020_us_county_20m.shp: build/cb_2020_us_county_20m.zip
	unzip -od $(dir $@) $<
	touch $@

#PREVIOUS : 
#build/counties.json: build/cb_2020_us_county_20m.shp
#node preprocess.js

build/counties.json: build/gz_2010_us_050_00_20m.shp ACS_12_5YR_B01003_with_ann.csv
	node_modules/.bin/topojson \
		-o $@ \
		--id-property='STATE+COUNTY,Id2' \
		--external-properties=ACS_12_5YR_B01003_with_ann.csv \
		--properties='name=Geography' \
		--properties='population=+d.properties["Estimate; Total"]' \
		--projection='d3.geo.albersUsa().scale(1280).translate([480, 300])'
		--simplify=.5 \
		-- counties=$<
